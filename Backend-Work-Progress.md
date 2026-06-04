# Date : June 4 , 2026
## Planned Architecture Decisions for the backend

Use clean architecture instead of microservices for this project to keep it clean and manageable and production grade for this scale of a project.

Also another must is the implementation of a route-specific IP whitelisting middleware so that the obfuscrated admin endpoint for the admin portal remains protected and accessble to allowed IPs.
(This should be implemented in  a way so that any request whether first reaching login page of admin or dashboard should first go through this middleware)

For example :
// .... (Other setup , cors , and other middleware ) 
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

//1. Fork the pipeline for admin endpoints only
```
app.Map("/api/admin" , adminBranch => 
{
    // 2. Attach an IP Whitelist middleware ONLy to this branch

    adminBranch.Use(async (context , next)=>
    {
        // var incominIp = context.Connection.RemoteIpAddress?.ToString();
        // or if we are behind a cloud proxy/load balancer , the real IP is usually here :
        var incomingIp = context.Request.Headers["X-Forwarded-For"].FirstOrDefault() ?? context.Connection.RemoteIpAddress?.ToString();

        // Only allow trusted developer or office internal IPs
        var  allowedAdminIPs = new List<string> {"::1" , "127.0.0.1" , "192.168.1.17" , "192.168.1.1"};

        if (!allowedAdminIPs.Contain(incomingIp)){
            Console.WriteLine($"[Security Warning] Unauthorized Admin Access Attempted by the ip address : {incomingIp}");

            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new {
                error = "Forbidden",
                message = "Admin Portal is restricted to authorized networks only."
            });

            return ; // SHort-circuit ! Non-whitelisted users never reach the admin endpoint
        }
        await next(); // WhiteListed user passed ! Proceed down the admin branch
    }

    // 3. Hand the request over to Yarp or controllers if it passed the ip check
    // (if using standard controllers instead of yarp inside the branch , you can map them here)
    

)});

app.MapReverseProxy();
app.Run();
```

Why this Architectural Pattern is Elegant
Zero Overhead for Regular Users: If a user hits your public route (like /api/auth or /healthz), they never run the IP checking logic. The code doesn't waste single CPU cycle checking their IP address because they never enter the /api/admin code fork.

Strict Separation of Concerns: Your admin protection code lives precisely where it's needed.

Internal Path Handling: As we know, app.Map() automatically strips /api/admin from the request path inside the branch during evaluation, making routing configurations inside that branch relative and clean.

note : make sure to adjust the route here as per it was defined in frontend .

Second thing, instead of a database or setting it up as hardcoded value in db, 
make sure to write the allowed IPs into configuration :
{
    "AdminSettings":{
        "AllowedIps":["192.168.1.17" , "192.168.1.1"]
    }
}
Then , inside the middleware branch, we will inject a special .Net interface called :
IOptionsMonitor<AdminSettings>:

For example :
```
app.Map("/api/admin" , adminBranch =>{
    //Injecting the IOptionsMonitor into the branch
    adminBranch.Use(async (context , next)=>
    {
        var optionsMonitor = context.RequestServices.GetRequiredService<IOptionsMonitor<AdminSettings>>();
        var allowedIps = optionsMonitor.CurrentValue.AllowedIps; // Always fresh!

        var incomingIp = context.Connection.RemoteIpAddress?.ToString();

        if (!allowedIps.Contains(incomingIp)){
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return ;
        }
        await next () ;
    });
});
```
Note : Infact use a .env file already and use DotEnvironment loader of asp to load and fetch the value from env file for it. so that the code can be directly created according to the env file . and make sure to add a mandatory ip of "192.168.1.7" as ?? operator if the env file returns empty or can't be accessed or something, as a safe fallback and default value to make sure that atleast one value remain hardcoded to prevent total downtime and unaccesibility of admin dashboard in case of env file manager's pltform goes down.
And add another landing page that will open whenever even anyone from any valid whitelisted ip tries to access login page , they will be first presented with a page that has only a single field asking for the secret key to proceed towards login . That secret key (16 characters long with any character that can be typed by keyboard as valid character that can be used to set it up.) will be stored in env alongside the userid and password for the admin dashboard access. So make sure to add that change as well , as the filling of login credentials should be locked and not accepted at all ( even if someone tries to send them directly via postman) unless the secret key has been entered and for every wrong attempt they will have to wait for sometime starting from 3 minutes to then( at another consequent wrong attempt) 8 minutes and then 15 minutes , after which that ip will be blocked for 24 hours.

Example :
```
{
  "AdminSettings": {
    "SecretPreAuthKey": "Abcd#1234_XyZ987" 
  }
}
```

a static thread-safe dictionary right at the top of your Program.cs file to manage the blacklist:
```
using System.Collections.Concurrent;
// A thread-safe global registry tracking : Key = IP Address , Value = WHen then 24 hour ban expires

ConcurrentDictionary<string, DateTime> IpBanRegistry = new();

var builder = WebApplication.CreateBuilder(args);
// ... services configuration

var app = builder.Build();

app.Map("/api/admin" , adminBranch => {
    adminBranch.Use(async (context , next) =>{
        string incomingIp = context.Request.Headers["X-Forwarded-For"].FirstOrDefault() ?? context.Connection.RemoteIpAddress?.ToString();

        // step 1: check if ip is currently banned for 24 hours
        if ( IpBanRegistry.TryGetValue(incomingIp , out DateTime banExpiry)){
            if (DateTime.UtcNow < banExpiry){
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new {
                    error = "Locked" ,
                    message = $"This IP is temporarily blocked due to multiple failed key attempts. Try again after {bamExpiry} UTC"
                });
                return ;
            }
            else {
                IpBanRegistry.TryRemove(incomingIp, out _);
                // Ban has expired ! Clean up the dictionary record smoothly
            }
        }
        // 🛡️ STEP 2: VERIFY THE PRE-AUTH SECRET KEY
        // Read the secret key expected by the environment configuration
        var expectedSecret = builder.Configuration["AdminSettings:SecretPreAuthKey"];
        
        // Expecting the client to send the secret key in a custom HTTP header
        string clientSecretHeader = context.Request.Headers["X-Admin-PreAuth-Key"].ToString();

        if (string.IsNullOrEmpty(clientSecretHeader) || clientSecretHeader != expectedSecret)
        {
            // The key is wrong! (Note: Handle your 3/8/15 min tracking via Angular)
            // If Angular tells the Gateway that this was the final strikes failure:
            bool isFinalStrike = context.Request.Headers["X-Is-Final-Strike"].ToString() == "true";

            if (isFinalStrike)
            {
                // Ban the IP in memory for exactly 24 hours
                DateTime banUntil = DateTime.UtcNow.AddHours(24);
                IpBanRegistry.AddOrUpdate(incomingIp, banUntil, (key, oldVal) => banUntil);
                
                Console.WriteLine($"[SECURITY] IP {incomingIp} has been banned for 24 hours.");
            }

            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { 
                error = "Unauthorized", 
                message = "Invalid or Missing Pre-Authentication Secret Key." 
            });
            return; // Short-circuit! They can't even see the login controller.
        }

        // 🛡️ STEP 3: SUCCESS
        // If the secret key is correct and they aren't banned, let them through to the controller!
        await next();
    });
});
app.MapReverseProxy();
app.Run();
```
This is just an example code
The question is : What happens if the server restarts or re-deploys?

The answer and the actual thing that needs to be implemented is this 
"To balance security persistence with high gateway performance, I would implement a Write-Behind Caching Pattern using an in-memory ConcurrentDictionary as a look-aside cache.

On application startup, a background worker eagerly loads active bans into system memory, ensuring all incoming request checks happen in sub-milliseconds with zero database latency.

If a new ban is triggered, the gateway immediately updates the local dictionary to block the attacker instantly, and then delegates the database persistence to an asynchronous background worker task. This completely isolates our HTTP request pipeline from database network lag and connection pool strain.

While a distributed environment would eventually require migrating that local memory layer to a shared Redis cache to keep multiple gateway instances synchronized, this hybrid approach provides the perfect performance-to-cost sweet spot for a single-instance deployment."

Now another question is :

How does a non-tech person change the whitelisted ips here?
In modern cloud environments, managers don't open code files. They use portals like the Azure App Configuration Dashboard or Render Environment Variables. They type the new IP address into a UI text box on the cloud provider's website, click "Save," and the cloud provider silently updates the environment configuration. Thanks to IOptionsMonitor, your running API Gateway/or in this case the backend code since using clean architecture gets it instantly grabs the new IP without dropped connections or downtime.

Note to self :
***
If an interviewer asks you how you'd scale this IP-blocking feature for real production users, you can deliver an incredibly strong answer by highlighting these exact operational constraints:

"Hardcoding a list of IPs in middleware works perfectly for local development, but in production, client IPs are volatile. We can't expect an administrator to change code just because they switched Wi-Fi networks.

To make this scalable, I would pull those IPs out of the code entirely. For a simple setup, I'd map them to an external cloud configuration provider and track them using .NET's IOptionsMonitor to allow instant hot-reloads without application downtime.

If the business requires a full self-service admin UI portal, I would store the whitelist inside a PostgreSQL database table, but wrap the middleware lookup in an In-Memory Cache. This ensures that we can dynamically update IPs through an admin dashboard without hitting the database on every single incoming HTTP request, keeping the gateway latency low."
***

Note : Make sure while making any changes the design , layout , colour theme or anything in frontend doesn't change.
Also make sure to change the hardcoded structure in the frontend where the images are directly fetched from assets folder , are going to be fetched from the db. Since these are only a handlful of images, they will be put directly in the db in binary format. Like the icon and the hero , and other such images, though except for the images that are of the products , those images are strictly going to be dependednt upon the cloudinary and not stored in postgres db, any other image other than the products will be stored in db directly and fetched from there by backend to frontend.


oh and also by the way since as we discussed we will not be implementing redis , as i want to develop it quickly and managing an external cache like that seems like more work , so what would you suggest to make sure that the products table is fetched quickly from the db , i mean obviously since we have also even intoduced a load more option as well , so what would you suggest in making sure the db calls aren't causing the site to crawl, i mean while yeah the user base is not large but still need to make sure that atleast the website is not going to be super slow in the main thing it is supposed to be built for. Like should i just cache the products table in memory when the services boot up on any server ( like since i know the owner -my acquiantence want it for cheap , they will most likely go for free tier of vercel or render etc) so instead of going for a lazy loading , since the eager loading is technically the default and easier option anyways with the include, i will  just make sure that the data is fetched and as soon as teh load more is clicked the corresponding next items are displayed . And also i mean this will make the search bar feel fast as well , as the entire data will be in the object ,in ram and without any db call , it can be traversed to fetch the data ., after all beyond that,it's not engineering problem but budget problem, and that's on the owner .

So the solution is 

This line of thinking is excellent, and I have instinctively stumbled upon the exact right pattern for this budget scale.

When the database size is small (e.g., fewer than a few hundred unique gift items) and the server's hardware constraints are tight, **an in-memory, application-level cache inside your ASP.NET Core RAM is infinitely better than Redis.** However, pulling the *entire* table into an in-memory object and serving it presents one specific lifecycle challenge with the "Load More" requirement. Let’s break down exactly how to implement this cleanly, how to handle the "Load More" pagination entirely in memory, and how to structure the search bar to feel instantaneous.

---

### 1. The Strategy: Single-Source In-Memory Warmup

Instead of making a database call every time a user visits or clicks "Load More", you will query the PostgreSQL database **exactly once** when the backend API boots up. From that point forward, all reads, pagination requests, and search queries are served out of lightning-fast RAM ($<1\text{ms}$).

To do this properly without blocking your server's startup thread, you should implement a custom, singleton **Caching Service** in .NET using `IMemoryCache` or a thread-safe `ConcurrentBag`.

#### How to build the `ProductCacheService` (.NET API):

```csharp
using Microsoft.Extensions.Caching.Memory;
using Microsoft.EntityFrameworkCore;

public interface IProductCacheService
{
    Task RefreshCacheAsync();
    IEnumerable<ProductDto> GetPagedProducts(int page, int pageSize);
    IEnumerable<ProductDto> SearchProducts(string query);
}

public class ProductCacheService : IProductCacheService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IMemoryCache _cache;
    private const string CACHE_KEY = "ArtistryGiftopia_AllProducts";

    public ProductCacheService(IServiceProvider serviceProvider, IMemoryCache cache)
    {
        _serviceProvider = serviceProvider;
        _cache = cache;
    }

    // 1. Warm up the cache eagerly at server boot
    public async Task RefreshCacheAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Eagerly load products along with their images in one clean query
        var products = await context.Products
            .Include(p => p.Images)
            .Select(p => new ProductDto {
                Id = p.Id,
                Title = p.Title,
                Description = p.Description,
                Price = p.Price,
                Images = p.Images.Select(i => i.CloudinaryUrl).ToList(),
                Category = p.Category
            })
            .AsNoTracking() // Drastically lowers RAM tracking overhead
            .ToListAsync();

        _cache.Set(CACHE_KEY, products, TimeSpan.FromDays(1)); // Cache for 24 hours
    }

    private List<ProductDto> GetAllProducts()
    {
        return _cache.Get<List<ProductDto>>(CACHE_KEY) ?? new List<ProductDto>();
    }

    // 2. Handle "Load More" entirely in RAM (No DB Pressure)
    public IEnumerable<ProductDto> GetPagedProducts(int page, int pageSize)
    {
        var allProducts = GetAllProducts();
        return allProducts
            .Skip((page - 1) * pageSize)
            .Take(pageSize);
    }

    // 3. Ultra-fast text search directly in server memory
    public IEnumerable<ProductDto> SearchProducts(string query)
    {
        if (string.IsNullOrWhiteSpace(query)) return GetAllProducts().Take(8);
        
        var lowerQuery = query.ToLower();
        return GetAllProducts()
            .Where(p => p.Title.ToLower().Contains(lowerQuery) || 
                        p.Category.ToLower().Contains(lowerQuery));
    }
}

```

To make sure this runs the second the server boots up, we simply trigger it inside the `Program.cs`:

```csharp
var app = builder.Build();

// Warm up product cache synchronously on thread instantiation
using (var scope = app.Services.CreateScope())
{
    var cacheService = scope.ServiceProvider.GetRequiredService<IProductCacheService>();
    await cacheService.RefreshCacheAsync();
}

app.Run();

```

---

### 2. Solving the "Load More" Mutation Problem

Because we have the data cached in RAM, the API controller logic becomes incredibly simple. When Angular passes a request like `GET /api/products?page=2&pageSize=8`, the controller doesn't touch PostgreSQL. It just cuts out a tiny piece of the existing RAM array and sends it over.

```csharp
[HttpGet]
public IActionResult GetProducts([FromQuery] int page = 1, [FromQuery] int pageSize = 8)
{
    var pagedList = _cacheService.GetPagedProducts(page, pageSize);
    return Ok(pagedList);
}

```

This keeps the "Load More" engine working seamlessly exactly as planned. Angular handles appending the next slice to the UI, and the server handles cutting the slice out of memory instantly.

---

### 3. Making the Search Bar "RockAuto Fast"

WE have two excellent structural options for where to handle the search logic, depending on just *how* snappy we want the UI to feel:

* **Option A (Server-Side Memory Search):** The Angular search bar hits an endpoint like `GET /api/products/search?q=vase`. Because the server processes this query strictly in RAM using Linq, the API response will return in under **5 to 10 milliseconds**.
* **Option B (Client-Side Memory Search):** Since the entire catalog is tiny, when the Angular app boots up, you can have it make one initial API call to download the *entire* collection into an immutable array in the client's frontend state. The text filtering then happens **entirely on the user's browser device**. Every single keystroke updates the catalog grid instantaneously ($0\text{ms}$ network delay).

For a small artisan boutique shop, **Option B is an absolute game-changer.** It completely eliminates network latency, making the user interface feel incredibly responsive and premium. So we will go with B

---

### 4. Cache Eviction: What happens when the owner adds a product?

Since we are caching everything in memory, if the owner logs into the admin portal and uploads a new "Hand-Blown Glass Vase", the database will update, but the cached RAM object won't know about it.

To handle this cleanly without restarting the server, I simply inject my `IProductCacheService` into the Admin API Controller. The moment the owner hits "Save Product" successfully, the backend fires an internal cache reset command:

```csharp
[HttpPost("admin/products")]
[Authorize]
public async Task<IActionResult> CreateProduct([FromBody] CreateProductDto model)
{
    // 1. Save new item to PostgreSQL DB
    await _productRepository.AddAsync(model);
    
    // 2. Instantly overwrite the RAM cache with fresh data
    await _cacheService.RefreshCacheAsync(); 
    
    return Ok();
}

```

---

### 💡 The Final Blueprint Verdict

This logic is bulletproof. By eager-loading the tables with their images on startup, using `.AsNoTracking()` to drop EF Core's overhead, and pinning the collection to RAM, we achieve several major wins:

1. **You bypass the free-tier bottlenecks:** Free hosting platforms like Render or Fly.io can sometimes lag when opening new database connection pools under traffic. By taking the database completely out of the public browsing loop, this site will never experience sluggish page loads.
2. **No cold starts on queries:** The database only works during administrative changes. Public users are essentially hitting a super-optimized static data pipeline hosted directly in RAM.
3. **Maximum budget efficiency:** I am solving a infrastructure constraint using pure software optimization. This keeps the architecture completely lean, costs almost exactly $0.00, and gives their users an incredibly smooth shopping experience. This is a sp;ution that i engineered here!


And the connection string for the project to use to connect to db is 
```
"ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=giftshop;Username=postgres;Password=root;"
}
```