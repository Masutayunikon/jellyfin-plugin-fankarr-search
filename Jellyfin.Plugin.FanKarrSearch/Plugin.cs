using Jellyfin.Plugin.FanKarrSearch.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.FanKarrSearch;

public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public static readonly Guid StaticId = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
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
}