using System.Reflection;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.FanKarrSearch.Controllers;

/// <summary>
/// Exposes two endpoints consumed by the injected JS:
///   GET /FanKarr/config   → returns the configured API URL (JSON)
///   GET /FanKarr/script.js → serves the embedded JS file
/// </summary>
[ApiController]
[Route("FanKarrSearch")]
public class FanKarrSearchController : ControllerBase
{
    // -------------------------------------------------------------------------
    // GET /FanKarr/config
    // Returns the FanKarr API base URL so the frontend JS can call it.
    // No auth required — the URL itself is not secret and the JS needs it
    // before the user has exchanged their Jellyfin token.
    // -------------------------------------------------------------------------

    [HttpGet("config")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<ConfigResponse> GetConfig()
    {
        var apiUrl = Plugin.Instance?.Configuration.ApiUrl ?? string.Empty;
        return Ok(new ConfigResponse(apiUrl));
    }

    // -------------------------------------------------------------------------
    // GET /FanKarr/script.js
    // Serves the embedded fankarr.js resource so index.html can load it.
    // -------------------------------------------------------------------------

    [HttpGet("script.js")]
    [AllowAnonymous]
    [Produces("application/javascript")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetScript()
    {
        var assembly = Assembly.GetExecutingAssembly();
        // Resource name = AssemblyName + path with dots replacing slashes
        const string ResourceName = "Jellyfin.Plugin.FanKarrSearch.Web.fankarr.js";

        var stream = assembly.GetManifestResourceStream(ResourceName);
        if (stream is null)
            return NotFound();

        return File(stream, "application/javascript");
    }

    // -------------------------------------------------------------------------
    // DTO
    // -------------------------------------------------------------------------

    public record ConfigResponse(string ApiUrl);
}
