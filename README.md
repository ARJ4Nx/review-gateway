# Review Gateway

Real, database-backed version of the review funnel + business dashboard, built with React, Vite, and Supabase.

## Deploy it (no coding required from here)

### 1. Put this on GitHub
1. Go to github.com, create a free account if you don't have one.
2. Click **New repository**, name it `review-gateway`, keep it Public or Private (either works), click **Create repository**.
3. On the new repo page, click **uploading an existing file** and drag in every file from this folder (keep the `src` folder structure intact).
4. Commit the files.

### 2. Deploy on Vercel
1. Go to vercel.com, sign up free (you can sign up directly with your GitHub account — easiest option).
2. Click **Add New → Project**, select your `review-gateway` repo.
3. Before clicking deploy, open **Environment Variables** and add two:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon public key
4. Click **Deploy**. In about a minute you'll get a live link like `review-gateway.vercel.app`.

### 3. Test it
Visit your new live link, create a test business account, add a Google review link in Settings, copy your customer link from Settings, open it in a new tab (or on your phone), and submit a test review. Confirm it shows up back in the dashboard.

### 4. (Optional) Add a custom domain
In your Vercel project, go to **Settings → Domains** and add a domain you've bought from somewhere like Namecheap — Vercel will show you exactly what DNS records to add.

### 5. (Later) Add real payments
The plan-switching in Settings is instant and free right now. When you're ready to actually charge the £5/£10/£20 tiers, this needs Stripe Checkout + a Stripe webhook wired to update the `tier` column in the `businesses` table — worth doing once you have paying businesses lined up.

## Local development (optional)
If you ever want to run this on your own computer before deploying:
```
npm install
cp .env.example .env
# then paste your real Supabase keys into .env
npm run dev
```
