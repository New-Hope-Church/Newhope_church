# New Hope Church Website

The website of New Hope Church, Nepal: plain HTML, CSS and JavaScript with no build step, in English and Nepali. It is served by nginx in a Docker container.

The design wireframes are in [Figma](https://www.figma.com/design/ekGGhbOf0Lnov2Kty1Hste/church-wireframe?node-id=1-470&t=5NoGYjqTf7kOv42L-1).

## Pages

| Page | What it is |
| --- | --- |
| `index.html` | Home page. Its footer is also used by every other page (see below). |
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

Pages link to each other without `.html` (`href="events"`); nginx adds it.

## Folders

```
css/style.css          site styles
css/camp-photos.css    camp photo pages
js/script.js           menu, English/Nepali switch, shared footer, forms, photo strip
js/camp-photos.js      camp photo pages
pictures/              images used by the site
pictures/source/       original photos and unused files, kept but never published
apps-script/           Google Apps Script code behind the forms (not served)
nginx.conf, Dockerfile the web server
```

## Editing

- **Text** is written twice, in `data-en` and `data-np` attributes, and the language button switches between them. Change both.
- **The footer** only lives in `index.html`. Other pages have an empty `<footer class="site-footer"></footer>`, which `js/script.js` fills from the home page. It only appears when the site is served (Docker or a local server), not when you open a file directly.
- **The menu** is copied into each page, so a menu change has to be made in every page.
- **Images:** put full-size originals in `pictures/source/`. Put a web copy in `pictures/` (WebP, about 1600 px wide and under 300 KB) and use that in the page. For example:
  `ffmpeg -i pictures/source/photo.jpg -vf scale=1600:-2 -c:v libwebp -quality 78 pictures/photo.webp`
- **After changing CSS or JS,** raise the number in `version.txt` and in the `?v=` after `style.css`, `script.js` and the camp photo files on every page, so browsers load the new version.

## Forms (Google Apps Script)

The contact, giving and Youth Camp forms post to a Google Apps Script web app whose URL is `NH_FORMS_ENDPOINT` in `js/script.js`. The camp photo pages use a separate web app, `NH_PHOTOS_ENDPOINT` in `js/camp-photos.js`. The code for both is in `apps-script/`, and the comment at the top of each file explains how to install it. After you redeploy a script, update the URL in the matching JS file.

## Running it

Locally, any static server works, for example `python -m http.server 8080`, then open http://localhost:8080. Use Docker if you want the clean `.html`-free links.

With Docker:

```
docker build -t newhope .
docker run --rm -p 8080:80 newhope
```

## Deployment

Every push to `main` runs `.github/workflows/publish-ghcr.yml`. The workflow builds the Docker image and publishes it to the GitHub Container Registry as `ghcr.io/<owner>/<repo>`, tagged `latest` and with the commit hash. `.dockerignore` keeps `pictures/source/`, `apps-script/` and other non-site files out of the image.
