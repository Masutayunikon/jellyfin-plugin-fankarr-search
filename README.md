# jellyfin-plugin-fankarr

Plugin Jellyfin 10.11 qui intègre **FanKarr** dans la recherche native.

## Ce que ça fait

- Injecte une section **"Découvrir sur FanKarr"** dans la page de recherche Jellyfin
- Affiche les résultats de ton API (`GET /api/v1/series/search?q=`)
- Bouton **"Demander"** pour chaque résultat (`POST /api/v1/requests`)
- Auth automatique via ton endpoint `POST /api/v1/auth/jellyfin`
- Mémorise les médias déjà demandés (bouton grisé)

## Build

```bash
dotnet build Jellyfin.Plugin.FanKarr.sln -c Release
```

Le DLL se trouve dans :
`Jellyfin.Plugin.FanKarr/bin/Release/net8.0/Jellyfin.Plugin.FanKarr.dll`

## Installation manuelle

1. Créer un dossier `FanKarr` dans ton répertoire plugins Jellyfin :
   - **Docker/Linux** : `/config/plugins/FanKarr/`
   - **Windows** : `%LOCALAPPDATA%\jellyfin\plugins\FanKarr\`
2. Copier `Jellyfin.Plugin.FanKarr.dll` dans ce dossier
3. Redémarrer Jellyfin
4. Aller dans **Dashboard → Plugins → FanKarr**
5. Renseigner l'URL de ton API FanKarr et sauvegarder
6. Redémarrer Jellyfin (pour l'injection dans index.html)

## Docker — permission sur index.html

Si Jellyfin tourne en Docker sans root, il faut mapper index.html :

```yaml
services:
  jellyfin:
    volumes:
      - /path/to/config:/config
      - /path/to/config/index.html:/usr/share/jellyfin/web/index.html
```

Lance Jellyfin une première fois sans le mapping pour générer le fichier,
puis ajoute le volume et redémarre.

## Structure du projet

```
Jellyfin.Plugin.FanKarr/
├── Configuration/
│   └── PluginConfiguration.cs   # Stocke l'URL de l'API
├── Controllers/
│   └── FanKarrController.cs     # GET /FanKarr/config + GET /FanKarr/script.js
├── Web/
│   ├── fankarr.js               # Toute la logique frontend (embarquée dans le DLL)
│   └── config.html              # Page de config dans le Dashboard
├── Plugin.cs                    # Entrée du plugin + injection dans index.html
└── PluginServiceRegistrator.cs  # Enregistrement DI
```

## Adapter à ton API

Les seuls endroits à modifier si ton API change :

| Ce qui change | Fichier | Ligne |
|---|---|---|
| Format de réponse auth | `fankarr.js` | fonction `authenticate()` |
| Format de réponse search | `fankarr.js` | fonction `onSearch()` |
| Corps de la demande | `fankarr.js` | fonction `handleRequest()` |
| Champs affichés (titre, poster…) | `fankarr.js` | fonction `renderResults()` |
