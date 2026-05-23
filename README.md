# FanKarr Search — Plugin Jellyfin

Plugin Jellyfin qui injecte une section **"Découvrir sur FanKaï"** dans la page de recherche. Vos utilisateurs peuvent parcourir le catalogue FanKaï et demander des séries directement depuis Jellyfin.

---

## Prérequis

Ce plugin nécessite **[Jellyfin JavaScript Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector)** pour fonctionner. Il permet d'injecter du JavaScript personnalisé dans l'interface Jellyfin.

Si vous ne l'avez pas encore, installez-le d'abord en suivant les instructions de son dépôt.

---

## Installation

### 1. Ajouter le dépôt de plugins

Dans Jellyfin, allez dans **Dashboard → Plugins → Dépôts** et ajoutez un nouveau dépôt :

| Champ | Valeur |
|-------|--------|
| Nom | `FanKarr Search` |
| URL | `https://masutayunikon.github.io/jellyfin-plugin-fankarr-search/manifest.json` |

### 2. Installer le plugin

Allez dans **Dashboard → Plugins → Catalogue**, recherchez **FanKarr Search** et cliquez sur **Installer**.

Redémarrez Jellyfin après l'installation.

### 3. Configurer l'URL de l'API

Allez dans **Dashboard → Plugins → FanKarr Search** et renseignez l'URL de votre instance FanKarr :

```
http://localhost:9898
```

Sans slash final. Adaptez l'adresse et le port selon votre configuration.

### 4. Ajouter le script dans JavaScript Injector

Allez dans les paramètres de **JavaScript Injector** et ajoutez le lien vers le script FanKarr fourni par le plugin.

---

## ⚠️ HTTPS et mixed content

Si votre instance Jellyfin est accessible en **HTTPS**, l'URL FanKarr doit **également être en HTTPS**.

Les navigateurs bloquent les requêtes HTTP depuis une page HTTPS (mixed content). Si vous accédez à Jellyfin en `https://` et que l'URL FanKarr est en `http://`, les appels seront bloqués silencieusement et le plugin ne fonctionnera pas.

---

## Fonctionnalités

- **Recherche intégrée** — une section FanKaï apparaît automatiquement dans les résultats de recherche Jellyfin.
- **Demande de séries** — les utilisateurs peuvent demander une série entière ou des saisons spécifiques en un clic.
- **Demander plus** — si une série a déjà été partiellement demandée, les utilisateurs peuvent ajouter des saisons supplémentaires sans doublon.
- **Authentification transparente** — le plugin s'authentifie automatiquement auprès de FanKarr via le token Jellyfin de l'utilisateur.