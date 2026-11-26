# New Hope Church Website

The website of New Hope Church, Nepal: plain HTML, CSS and JavaScript with no build step, in English and Nepali. It is served by nginx in a Docker container.

The design wireframes are in [Figma](https://www.figma.com/design/ekGGhbOf0Lnov2Kty1Hste/church-wireframe?node-id=1-470&t=5NoGYjqTf7kOv42L-1).

## Pages

| Page | What it is |
| --- | --- |
| `index.html` | Home page |
| `about.html` | Beliefs and leadership |
| `connect.html` | Visit details, map, online services and the contact form |
| `events.html` | Upcoming events and regular gatherings |
| `groups.html` | Small groups |
| `give.html` | Giving by bank transfer or digital wallet |
| `testimonies.html` | Testimonies. It still has placeholder text, so no menu links to it yet. |
| `youth-camp-register.html` | Youth Camp registration and payment |
| `camp-photos.html` | Youth Camp photos: campers scan a QR code to send photos (no login), and browse and like the approved ones |
| `camp-photos-live.html` | Projector slideshow of the camp album |
| `camp-photos-poster.html` | Printable QR poster for the camp photo page |
| `404.html` | Shown for any address that doesn't exist |

Pages link to each other without `.html` (`href="events"`); nginx adds it.

## Folders

```
css/style.css          site styles
css/camp-photos.css    camp photo pages
js/config.js           web addresses of the Google Apps Script web apps
js/script.js           every page: English/Nepali switch, menu, map picker, scroll effects, photo strip
js/forms.js            Connect, Give and Youth Camp pages: forms and the Give page tabs
js/camp-photos.js      camp photo pages
partials/              the header (menu) and footer shared by every page
pictures/              images used by the site
pictures/source/       original photos and unused files, kept but never published
apps-script/           Google Apps Script code behind the forms (not served)
robots.txt, sitemap.xml  for search engines (update sitemap.xml when you add a page)
nginx.conf, nginx/     the web server and its security headers
Dockerfile             builds the image
.github/               publish and check workflows, monthly update checks
```

## Editing

- **Text** is written twice, in `data-en` and `data-np` attributes, and the language button switches between them. Change both.
- **The menu and footer** are in `partials/header.html` and `partials/footer.html`. nginx inserts them wherever a page has `<!--# include file="/partials/header.html" -->` (and the same for the footer), so edit them there once. The menu link for the current page is highlighted by `js/script.js`. A page that belongs under another menu item says so on its `<body>`; for example, the Youth Camp page has `<body data-nav="events">`.
- **Styles** belong in `css/style.css`. Repeated patterns have classes there (`section-dark`, `bg-paper`, `btn-light`, `btn-row`, `form-status` and others, at the end of the file); inline `style=""` is left only for one-off sizes.
- **Images** need an `alt` text that says what the photo shows; use `alt=""` for decoration and for the logo next to the words "New Hope".
- **Images:** put full-size originals in `pictures/source/`. Put a web copy in `pictures/` (WebP, about 1600 px wide and under 300 KB) and use that in the page. For example:
  `ffmpeg -i pictures/source/photo.jpg -vf scale=1600:-2 -c:v libwebp -quality 78 pictures/photo.webp`
- **New pages** need a `<meta name="description">`, the `og:` tags and a canonical link in `<head>` (copy them from a similar page), and an entry in `sitemap.xml`.
- **New top-level files** the site needs (like `robots.txt`) must be added to the `COPY` line in the `Dockerfile`, which only publishes what it lists.
- **After changing CSS or JS,** raise the number in `version.txt` and in the `?v=` after `style.css` and every `js/` file on every page, so browsers load the new version.

## Forms (Google Apps Script)

The Give and Youth Camp forms post to a Google Apps Script web app (`formsEndpoint` in `js/config.js`). The camp photo pages use a separate one (`photosEndpoint` in the same file). The code for both is in `apps-script/`, and the comment at the top of each file explains how to install it. If a redeploy gives a script a new address, update it in `js/config.js`. The contact form on the Connect page doesn't use a web app: it opens the visitor's email app addressed to info@newhopenepal.org.

## Running it

The pages need nginx to insert the shared menu and footer, so run the site with Docker. Opening a file directly, or using a plain static server, shows pages without them.

```
docker build -t newhope .
docker run --rm -p 8080:80 newhope
```

Then open http://localhost:8080. To see edits without rebuilding, use the same nginx settings and serve the folder directly:

```
docker run --rm -p 8080:80 -v "$PWD/nginx.conf:/etc/nginx/conf.d/default.conf:ro" -v "$PWD/nginx/security-headers.conf:/etc/nginx/snippets/security-headers.conf:ro" -v "$PWD:/usr/share/nginx/html:ro" nginx:1.27-alpine
```

In Git Bash on Windows, put `MSYS_NO_PATHCONV=1 ` in front of that command, or Git Bash rewrites the paths and nginx finds nothing.

Camp photos from Google Drive don't load on `localhost` (Google refuses those requests); they work on the live site.

## Deployment

Every pull request runs `.github/workflows/check.yml`: it builds the image, starts it, and runs `.github/scripts/check-site.sh`. The script checks that every page, link and image works, that missing pages get `404.html`, and that the security headers are set. You can run it yourself against a running container: `bash .github/scripts/check-site.sh http://localhost:8080`.

Every push to `main` runs the same check, then `.github/workflows/publish-ghcr.yml`, which builds the Docker image and publishes it to the GitHub Container Registry as `ghcr.io/<owner>/<repo>`, tagged `latest` and with the commit hash. `.dockerignore` keeps `pictures/source/`, `apps-script/` and other non-site files out of the image.

The security policy (`Content-Security-Policy`) in `nginx/security-headers.conf` is in report-only mode: browsers show what it would block in the developer console but block nothing. Once the live pages show no such reports, it can be switched on (see the comment in that file).
