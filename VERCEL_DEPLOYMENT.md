# Vercel Deployment Guide 🚀

## Quick Summary
Your code is already pushed to GitHub on branch `claude/timetable-attendance-tracker-m2um3x`. Now we'll deploy it to Vercel!

## Prerequisites ✅

- [ ] GitHub account (already have it)
- [ ] Vercel account (free at vercel.com)
- [ ] Neon database created (or PostgreSQL database ready)
- [ ] Email for deployment notifications

## Step 1: Prepare Your Database 🗄️

### Option A: Use Neon (Recommended - Free Tier Available)

1. Go to https://neon.tech
2. Sign up for free account
3. Create a new project
4. Click "SQL Editor" and run migrations manually, OR
5. Get your connection string:
   - Copy the "Connection string" from Neon dashboard
   - Should look like: `postgresql://user:password@host:port/database?sslmode=require`

### Option B: Use Your Existing PostgreSQL

If you already have a database:
- Get your connection string ready
- Should be accessible from internet (not localhost)

**Your Connection String:**
```
DATABASE_URL = postgresql://...
DIRECT_URL = postgresql://... (same for Neon)
```

## Step 2: Create Vercel Project 📱

1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Click "Import Git Repository"
4. Search for "timetable" or "peru-107/timetable"
5. Select the repository
6. Click "Import"

## Step 3: Configure Environment Variables 🔐

In the Vercel import screen, you'll see "Environment Variables" section.

**Add these variables:**

```
DATABASE_URL = postgresql://user:password@host:port/database?sslmode=require
DIRECT_URL = postgresql://user:password@host:port/database?sslmode=require
NEXTAUTH_SECRET = (generate below)
NEXTAUTH_URL = https://your-vercel-url.vercel.app
```

### Generate NEXTAUTH_SECRET

Use this command to generate a secure secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Or use an online generator: https://generate-secret.vercel.app/

**Example values:**
```
DATABASE_URL = postgresql://admin:abc123@ep-cool-lake-12345.us-east-1.neon.tech/timetable?sslmode=require
DIRECT_URL = postgresql://admin:abc123@ep-cool-lake-12345.us-east-1.neon.tech/timetable?sslmode=require
NEXTAUTH_SECRET = aBcDeFgHiJkLmNoPqRsT+uVwXyZ==
NEXTAUTH_URL = https://timetable-tracker.vercel.app
```

## Step 4: Deploy 🎉

1. Make sure all environment variables are filled in
2. Click "Deploy"
3. Wait for the deployment to complete (2-3 minutes)
4. You'll see the deployment success page with your URL

**Your app will be live at:**
```
https://timetable-tracker.vercel.app
```
(or whatever custom name you choose)

## Step 5: Initialize Database Schema 🔄

After deployment, you need to create the database schema:

### Option A: Using Vercel CLI (Recommended)

```bash
# Install Vercel CLI if you don't have it
npm i -g vercel

# Login to Vercel
vercel login

# Pull environment variables
vercel env pull

# Push database schema
npm run db:push
```

### Option B: Using Neon Dashboard

1. Go to your Neon project
2. Click "SQL Editor"
3. Copy the schema from `prisma/schema.prisma` and run migrations
4. Or use Prisma in a local environment:
   ```bash
   npm run db:push
   ```

### Option C: One-Time Setup Script

Create a setup endpoint temporarily:

```typescript
// app/api/setup/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // This will create all tables
    await prisma.$executeRaw`SELECT 1`;
    return NextResponse.json({ message: "Database is ready" });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

Then visit: `https://your-app.vercel.app/api/setup`

## Step 6: Test Your Deployment ✅

1. Visit your Vercel URL
2. Sign up for a new account
3. Create a semester
4. Add a course
5. Test all features:
   - [ ] Login/Logout works
   - [ ] Create semester
   - [ ] Add courses
   - [ ] Add timetable entries
   - [ ] Mark attendance
   - [ ] Add grades
   - [ ] View calendar

## Step 7: Set Custom Domain (Optional) 🌐

If you have a custom domain:

1. In Vercel → Project Settings → Domains
2. Add your domain
3. Follow DNS setup instructions
4. Update `NEXTAUTH_URL` to your custom domain
   - Go to Settings → Environment Variables
   - Change `NEXTAUTH_URL` to `https://yourdomain.com`

## Step 8: Monitor Your Deployment 📊

### View Logs
```bash
vercel logs
```

### Check Deployment Status
- Visit: https://vercel.com/dashboard
- Click your project
- See recent deployments and status

### Enable Analytics
- Vercel → Project Settings → Analytics
- Enable Web Analytics and Monitoring

## Troubleshooting 🔧

### Issue: "Failed to connect to database"

**Solution:**
1. Verify DATABASE_URL is correct in Vercel
2. Check Neon IP whitelist (if using Neon)
3. Ensure database exists
4. Try locally first: `npm run db:push`

### Issue: "NEXTAUTH_SECRET is not set"

**Solution:**
1. Check Environment Variables in Vercel
2. Regenerate secret: `openssl rand -base64 32`
3. Redeploy: `vercel --prod`

### Issue: "500 error on login"

**Solution:**
1. Check Vercel logs: `vercel logs`
2. Verify NEXTAUTH_URL matches your domain
3. Check database is initialized

### Issue: "Deployment failed during build"

**Solution:**
1. Check build logs in Vercel
2. Common issues:
   - Missing environment variables
   - Node.js version mismatch
   - Build command failing
3. Try locally: `npm run build`

## Redeployment & Updates 🔄

### Deploy New Changes

```bash
cd /home/user/timetable
git add .
git commit -m "Your change description"
git push origin claude/timetable-attendance-tracker-m2um3x
```

Vercel will automatically redeploy when you push!

### Manual Redeploy

```bash
vercel --prod
```

## Important Files for Production ⚠️

Make sure these are properly configured:

- ✅ `.env.local` - Never commit this (already in .gitignore)
- ✅ `NEXTAUTH_SECRET` - Must be strong and unique
- ✅ `DATABASE_URL` - Must be production database
- ✅ `NEXTAUTH_URL` - Must match your domain

## Security Checklist 🔒

- [ ] NEXTAUTH_SECRET is strong (32+ characters)
- [ ] Database password is strong
- [ ] DATABASE_URL uses SSL/TLS (sslmode=require)
- [ ] No secrets committed to GitHub
- [ ] NEXTAUTH_URL matches deployment domain
- [ ] Enable HTTPS (automatic with Vercel)

## Performance Tips ⚡

1. **Database:** Neon has built-in connection pooling
2. **Images:** Next.js automatically optimizes images
3. **Caching:** Vercel CDN serves static files globally
4. **Serverless:** API routes auto-scale

## Monitoring & Maintenance 🛠️

### Weekly Checks
- [ ] Check Vercel dashboard for errors
- [ ] Monitor database performance
- [ ] Review application logs

### Monthly Tasks
- [ ] Update dependencies: `npm update`
- [ ] Backup database (Neon auto-backs up)
- [ ] Review usage and logs

## Scaling (When Needed)

### Database Limits Reached
1. Upgrade Neon plan
2. Implement database caching
3. Archive old semester data

### API Rate Limits
1. Implement rate limiting
2. Add caching layer
3. Optimize database queries

### Storage Limits
1. Use Vercel Blob for file storage
2. Implement cleanup jobs
3. Archive old uploads

## Next Steps After Deployment 🚀

1. ✅ Share your URL with friends/classmates
2. ✅ Get feedback on the app
3. ✅ Add more features based on feedback
4. ✅ Set up monitoring and analytics
5. ✅ Consider mobile app version

## Quick Command Reference

```bash
# Local development
npm run dev                 # Start dev server
npm run build               # Build for production
npm run db:push             # Initialize database

# Vercel deployment
vercel login                # Login to Vercel
vercel                      # Deploy (staging)
vercel --prod               # Deploy to production
vercel env pull             # Pull environment vars
vercel logs                 # View deployment logs

# Database management
npm run db:studio           # Open Prisma Studio
npm run db:generate         # Generate Prisma client
```

## Support & Resources

- **Vercel Docs:** https://vercel.com/docs
- **Neon Docs:** https://neon.tech/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs

---

**Your app will be live in minutes!** 🎉

Need help? Email: peruswag107@gmail.com
