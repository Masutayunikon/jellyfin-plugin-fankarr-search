using System.Reflection;
using System.Runtime.Loader;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.FanKarrSearch;

public class FanKarrStartupService : IHostedService
{
    private readonly ILogger<FanKarrStartupService> _logger;

    public FanKarrStartupService(ILogger<FanKarrStartupService> logger)
    {
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        // Délai pour laisser le temps à tous les plugins de se charger
        Task.Run(async () =>
        {
            await Task.Delay(5000, cancellationToken);
            RegisterScript();
        }, cancellationToken);

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

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

            var assembly = Assembly.GetExecutingAssembly();
            using var stream = assembly.GetManifestResourceStream("Jellyfin.Plugin.FanKarrSearch.Web.fankarr.js");
            if (stream == null)
            {
                _logger.LogWarning("[FanKarr] fankarr.js resource not found.");
                return;
            }

            using var reader = new StreamReader(stream);
            var scriptContent = reader.ReadToEnd();
            var plugin = Plugin.Instance!;

            var registration = new JObject
            {
                { "id", $"{plugin.Id}-fankarr-search" },
                { "name", "FanKarr Search" },
                { "script", scriptContent },
                { "enabled", true },
                { "requiresAuthentication", true },
                { "pluginId", plugin.Id.ToString() },
                { "pluginName", plugin.Name },
                { "pluginVersion", plugin.Version.ToString() }
            };

            var result = pluginInterfaceType.GetMethod("RegisterScript")
                ?.Invoke(null, new object[] { registration });

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