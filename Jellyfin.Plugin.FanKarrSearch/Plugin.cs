using System.Reflection;
using System.Runtime.Loader;
using Jellyfin.Plugin.FanKarrSearch.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.FanKarrSearch;

public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public static readonly Guid StaticId = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    private readonly ILogger<Plugin> _logger;

    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer, ILogger<Plugin> logger)
        : base(applicationPaths, xmlSerializer)
    {
        _logger = logger;
        Instance = this;
        RegisterScript();
    }

    public override string Name => "FanKarr Search";
    public override Guid Id => StaticId;
    public override string Description => "Intègre FanKarr dans la recherche Jellyfin.";
    public static Plugin? Instance { get; private set; }

    public IEnumerable<PluginPageInfo> GetPages() => new[]
    {
        new PluginPageInfo
        {
            Name = Name,
            EmbeddedResourcePath = $"{GetType().Namespace}.Web.config.html",
            EnableInMainMenu = false
        }
    };

    private void RegisterScript()
    {
        try
        {
            var jsInjectorAssembly = AssemblyLoadContext.All
                .SelectMany(x => x.Assemblies)
                .FirstOrDefault(x => x.FullName?.Contains("Jellyfin.Plugin.JavaScriptInjector") ?? false);

            if (jsInjectorAssembly == null)
            {
                _logger.LogWarning("[FanKarr] JavaScript Injector plugin not found.");
                return;
            }

            var pluginInterfaceType = jsInjectorAssembly.GetType("Jellyfin.Plugin.JavaScriptInjector.PluginInterface");
            if (pluginInterfaceType == null)
            {
                _logger.LogWarning("[FanKarr] PluginInterface type not found.");
                return;
            }

            // Lire le JS embarqué
            var assembly = Assembly.GetExecutingAssembly();
            using var stream = assembly.GetManifestResourceStream("Jellyfin.Plugin.FanKarrSearch.Web.fankarr.js");
            if (stream == null)
            {
                _logger.LogWarning("[FanKarr] fankarr.js resource not found.");
                return;
            }
            using var reader = new StreamReader(stream);
            var scriptContent = reader.ReadToEnd();

            var registration = new JObject
            {
                { "id", $"{Id}-fankarr-search" },
                { "name", "FanKarr Search" },
                { "script", scriptContent },
                { "enabled", true },
                { "requiresAuthentication", true },
                { "pluginId", Id.ToString() },
                { "pluginName", Name },
                { "pluginVersion", Version.ToString() }
            };

            var result = pluginInterfaceType.GetMethod("RegisterScript")?.Invoke(null, new object[] { registration });

            if (result is bool success && success)
                _logger.LogInformation("[FanKarr] Script registered with JavaScript Injector.");
            else
                _logger.LogWarning("[FanKarr] Failed to register script.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[FanKarr] Error registering script.");
        }
    }
}