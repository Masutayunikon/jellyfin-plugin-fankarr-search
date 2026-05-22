using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.FanKarrSearch.Configuration;

/// <summary>
/// Plugin configuration stored in Jellyfin's config directory.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// Gets or sets the base URL of the FanKarr API.
    /// Example: https://fankarr.example.com
    /// </summary>
    public string ApiUrl { get; set; } = string.Empty;
}
