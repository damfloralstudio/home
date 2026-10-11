# DAM Floral Studio

Website for [DAM Floral Studio](https://damfloralstudio.com), a floral design and spatial styling studio serving New Jersey and New York City.

A single static page hosted on GitHub Pages. No build step and no dependencies.

## Files

| Path | Purpose |
|---|---|
| `index.html` | The page: header, hero, gallery, studio copy, footer, image viewer and inquiry form |
| `style.css` | All styles |
| `script.js` | Image viewer, inquiry form (opens a prefilled email draft) and footer year |
| `assets/` | Photos, logo and hero title artwork |
| `assets/fonts/` | Self-hosted fonts and their licenses |
| `CNAME` | Custom domain for GitHub Pages. **Do not delete or rename.** |
| `.nojekyll` | Makes GitHub Pages serve the files as-is |
| `robots.txt`, `sitemap.xml` | Search engine configuration |

## Local preview

Open `index.html` in a browser. All paths are relative, so `assets/` must stay next to it.

## Deployment

GitHub Pages publishes from the root of the `main` branch. Changes go live a minute or two after they reach `main`.

- The custom domain is `damfloralstudio.com`, set by the `CNAME` file. `www.damfloralstudio.com` redirects to it.
- Every file in this repository is publicly accessible on the live site, so keep private notes out of the repo.

## Licenses

Fonts in `assets/fonts/` are distributed under the licenses included in that folder. Photography and brand assets are © DAM Floral Studio and may not be reused without permission.
