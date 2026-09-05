# DJ LK

Site DJ LK avec agenda dynamique administrable depuis `/admin`.

## Mise en ligne

Le projet utilise Netlify Functions + Netlify Blobs pour stocker les dates sans base de données externe.

### Variables Netlify obligatoires

Dans **Netlify → Project configuration → Environment variables** :

- `ADMIN_PASSWORD` : mot de passe de la page `/admin`
- `GROQ_API_KEY` : nouvelle clé Groq pour le chatbot (ne jamais la mettre dans le HTML)

Après avoir ajouté/modifié ces variables, redéployer le site.

### Administration

Ouvre `https://ton-domaine.ch/admin` sur ton téléphone, connecte-toi, puis ajoute/modifie/supprime les dates.

## Sécurité

L'ancienne clé Groq qui se trouvait directement dans `index.html` doit être révoquée/régénérée. Une clé API exposée dans le navigateur doit être considérée comme compromise, même après suppression du fichier du dernier commit.
