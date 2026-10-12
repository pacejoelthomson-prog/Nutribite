# BiteLens Domain Migration Playbook (To Rank #1 on Google)

## 1. Why a Custom Domain Is Mandatory to Rank #1
Google and search engines evaluate **Root Domain Trust**. While your app works perfectly on `nutribite-cvg1.onrender.com`, search engines treat `onrender.com` as a shared developer host. To dominate page 1 of Google for **"BiteLens"**, you must connect a custom domain:
* Recommended domains: **`bitelens.com`**, **`bitelens.app`**, or **`getbitelens.com`** (available on Namecheap, Cloudflare, Google Domains/Squarespace, or GoDaddy for ~$10/year).

---

## 2. Step-by-Step Domain Setup on Render

1. **Purchase your domain** (e.g. `bitelens.com` or `bitelens.app`).
2. Log into your **Render Dashboard** (https://dashboard.render.com).
3. Click on your **nutribite** service.
4. In the left navigation, click **Settings**.
5. Scroll down to **Custom Domains** and click **Add Custom Domain**.
6. Enter both:
   * `bitelens.com`
   * `www.bitelens.com`
7. Render will provide the exact DNS records to add:
   * **CNAME Record**: Host `www` → points to `nutribite-cvg1.onrender.com`
   * **ANAME or A Record**: Host `@` → points to Render's IP address (shown on your screen)
8. Render will automatically issue a free **SSL Certificate (HTTPS)** within 15–30 minutes.

---

## 3. Post-Migration Code Checklist (One-Minute Update)

Once your custom domain is active (e.g. `https://bitelens.com/`), simply search for `TODO: update after domain migration` in the codebase and update:
1. `public/robots.txt`: Change Sitemap URL to `https://bitelens.com/sitemap.xml`
2. `public/sitemap.xml`: Replace `https://nutribite-cvg1.onrender.com/` with `https://bitelens.com/`
3. Canonical & Open Graph tags in `index.html`, `scan.html`, `progress.html`, `results.html`: Update to `https://bitelens.com/`

---

## 4. Google Search Console & Ranking Playbook

1. Go to **Google Search Console** (https://search.google.com/search-console).
2. Add your custom domain property (`bitelens.com`).
3. Under **Sitemaps**, submit `https://bitelens.com/sitemap.xml`.
4. Click **URL Inspection**, enter your homepage, and click **Request Indexing**.
5. Because your site is branded with unique titles, meta descriptions, and structured JSON-LD schema, Google will index **BiteLens** as the primary branded entity and rank your site at the top of search results.
