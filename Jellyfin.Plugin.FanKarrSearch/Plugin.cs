using System.Reflection;
using Jellyfin.Plugin.FanKarrSearch.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.FanKarrSearch;

/// <summary>
/// FanKarr plugin entry point.
/// Injects a small JS loader into Jellyfin's index.html at startup.
/// The JS then calls the /FanKarr/config endpoint to get the API URL
/// and hooks into the Jellyfin search UI.
/// </summary>
public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    private readonly ILogger<Plugin> _logger;

    /// <summary>Unique, stable plugin ID.</summary>
    public static readonly Guid StaticId = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    public Plugin(
        IApplicationPaths applicationPaths,
        IXmlSerializer xmlSerializer,
        ILogger<Plugin> logger)
        : base(applicationPaths, xmlSerializer)
    {
        _logger = logger;
        Instance = this;
        InjectScript();
    }

    /// <inheritdoc />
    public override string Name => "FanKarrSearch";

    /// <inheritdoc />
    public override Guid Id => StaticId;

    /// <inheritdoc />
    public override string Description => "Intègre FanKarr dans la recherche Jellyfin pour demander des médias.";

    /// <summary>Singleton access used by the controller.</summary>
    public static Plugin? Instance { get; private set; }

    // -------------------------------------------------------------------------
    // Config page (shown in Dashboard → Plugins → FanKarr)
    // -------------------------------------------------------------------------

    /// <inheritdoc />
    public IEnumerable<PluginPageInfo> GetPages()
    {
        return new[]
        {
            new PluginPageInfo
            {
                Name = Name,
                EmbeddedResourcePath = $"{GetType().Namespace}.Web.config.html",
                EnableInMainMenu = false
            }
        };
    }

    // -------------------------------------------------------------------------
    // JS injection into index.html
    // -------------------------------------------------------------------------

    /// <summary>
    /// Appends a &lt;script&gt; tag pointing to our API endpoint into
    /// Jellyfin's index.html so it loads on every page.
    /// </summary>
    private void InjectScript()
    {
        // Jellyfin serves its web client from the "jellyfin-web" folder.
        // The actual path varies by install type, but IApplicationPaths
        // exposes WebPath for exactly this purpose.
        // We look for index.html and inject a <script> tag if not already there.
        try
        {
            // Use reflection to find the web path — works across Jellyfin versions.
            var webPath = GetWebPath();
            if (webPath is null)
            {
                _logger.LogWarning("[FanKarr] Could not locate Jellyfin web path. JS not injected.");
                return;
            }

            var indexPath = Path.Combine(webPath, "index.html");
            if (!File.Exists(indexPath))
            {
                _logger.LogWarning("[FanKarr] index.html not found at {Path}", indexPath);
                return;
            }

            var content = File.ReadAllText(indexPath);
            const string Marker = "<!-- fankarr-injected -->";

            if (content.Contains(Marker))
            {
                _logger.LogInformation("[FanKarr] Script already injected, skipping.");
                return;
            }

            // Inject just before </body> — minimal footprint.
            var tag = $"\n{Marker}\n<script src=\"/FanKarrSearch/script.js\" defer></script>\n";
            var newContent = content.Replace("</body>", tag + "</body>", StringComparison.OrdinalIgnoreCase);

            File.WriteAllText(indexPath, newContent);
            _logger.LogInformation("[FanKarrSearch] Script injected into {Path}", indexPath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[FanKarrSearch] Failed to inject script into index.html");
        }
    }

    private static string? GetWebPath()
    {
        // Try common paths across Docker / Linux / Windows installs.
        var candidates = new[]
        {
            "/usr/share/jellyfin/web",
            "/jellyfin/jellyfin-web",
            @"C:\Program Files\Jellyfin\Server\jellyfin-web",
        };

        foreach (var path in candidates)
        {
            if (Directory.Exists(path) && File.Exists(Path.Combine(path, "index.html")))
                return path;
        }

        return null;
    }
}
