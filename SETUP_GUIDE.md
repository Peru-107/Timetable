# Setup Guide - Timetable Attendance Tracker

Complete step-by-step guide to get the Timetable Attendance Tracker running on your machine or in production.

## Prerequisites ✅

- Node.js 18 or higher
- npm or yarn package manager
- Git
- A Neon PostgreSQL database (free tier available at neon.tech)
- A Vercel account (for deployment)

## Local Development Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/peru-107/timetable.git
cd timetable
git checkout claude/timetable-attendance-tracker-m2um3x
```

### Step 2: Install Dependencies

```bash
npm install --legacy-peer-deps
```

The `--legacy-peer-deps` flag is needed due to some package version conflicts with React 19.

### Step 3: Set Up Database

#### Option A: Using Neon (Recommended for Production)

1. Go to [neon.tech](https://neon.tech) and sign up for free
2. Create a new project and database
3. Get your connection string from the Neon dashboard
4. Copy connection details to your `.env.local`:

```bash
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
DIRECT_URL="postgresql://user:password@host:port/database?sslmode=require"
```

#### Option B: Using Local PostgreSQL

1. Install PostgreSQL on your machine
2. Create a new database:
   ```bash
   createdb timetable_dev
   ```
3. Add to `.env.local`:
   ```bash
   DATABASE_URL="postgresql://localhost:5432/timetable_dev"
   DIRECT_URL="postgresql://localhost:5432/timetable_dev"
   ```

### Step 4: Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local with your values
```

**Required variables:**
```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXTAUTH_SECRET=your-random-secret-key-here
NEXTAUTH_URL=http://localhost:3000
```

**Generate a secure NEXTAUTH_SECRET:**
```bash
# Using OpenSSL
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 5: Initialize Database Schema

```bash
# Generate Prisma client
npm run db:generate

# Push schema to your database
npm run db:push

# (Optional) View your data in Prisma Studio
npm run db:studio
```

### Step 6: Run Development Server

```bash
npm run dev
```

Your app will be available at:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3000/api

### Step 7: Create Your First Account

1. Go to http://localhost:3000
2. Click "Sign Up"
3. Fill in your email and password
4. You'll be logged in and taken to the dashboard

## Features Quick Start

### Create a Semester
1. Click on "Create New Semester" button
2. Enter semester name (e.g., "Fall 2024")
3. Set start and end dates

### Add Courses
- Go to Dashboard → Timetable
- Click "+ Add Class"
- Select a course and fill in details

### Upload Timetable
- Go to Timetable page
- Click "📁 Upload (PDF/JPG/PNG)"
- Select your timetable image/PDF
- Manually add entries as shown in the file

### Track Attendance
- Go to Dashboard → Attendance
- Click "+ Mark Attendance"
- Select course, date, mark as present/absent

### Add Grades
- Go to Dashboard → Grades
- Click "+ Add Grade"
- Enter GPA for each course
- View calculated CGPA

### Create Calendar Events
- Go to Dashboard → Calendar
- Click "+ Add Event"
- Set type, date, and details

## Production Deployment 🚀

### Deploy to Vercel

#### Step 1: Push Code to GitHub

```bash
git push origin claude/timetable-attendance-tracker-m2um3x
```

#### Step 2: Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import the GitHub repository
4. Select the `claude/timetable-attendance-tracker-m2um3x` branch
5. Click "Deploy"

#### Step 3: Add Environment Variables

In Vercel project settings → Environment Variables, add:

```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXTAUTH_SECRET=your-production-secret
NEXTAUTH_URL=https://your-domain.vercel.app
```

#### Step 4: Run Database Migrations

After the first deployment:

```bash
# You can run migrations using Vercel CLI
vercel env pull
npm run db:push
```

Or connect to your Neon dashboard and ensure the schema is pushed.

#### Step 5: Verify Deployment

- Visit your Vercel URL
- Test signup, login, and features
- Check server logs for errors

### Custom Domain

1. In Vercel → Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXTAUTH_URL` in environment variables

## Database Management

### View Data with Prisma Studio

```bash
npm run db:studio
```

Opens at http://localhost:5555

### Backup Database

**For Neon:**
- Neon provides automated backups
- Download via Neon dashboard

**For Local PostgreSQL:**
```bash
pg_dump timetable_dev > backup.sql
```

### Reset Database

**Warning: This deletes all data!**

```bash
npm run db:push -- --force-reset
```

Then run seed script if you have one.

## Troubleshooting 🔧

### Issue: "Can't reach database"

**Solution:**
- Check DATABASE_URL is correct
- Verify database is running
- Ensure firewall allows connections
- For Neon, check IP whitelist

### Issue: "NEXTAUTH_SECRET not set"

**Solution:**
- Ensure `.env.local` has `NEXTAUTH_SECRET`
- Generate one if missing: `openssl rand -base64 32`
- For production, set in Vercel environment variables

### Issue: "Cannot find module 'next-auth'"

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Issue: Large file upload fails

**Solution:**
- Check upload file size (default limit ~5MB)
- For production, integrate Vercel Blob:
  ```bash
  npm install @vercel/blob
  ```
- Update `/api/upload` endpoint to use Blob

### Issue: Database migrations fail

**Solution:**
```bash
# Reset migrations locally
rm -rf prisma/migrations

# Regenerate from current schema
npm run db:push
```

## Performance Optimization

### Enable Image Optimization
Already included in Next.js config

### Database Connection Pooling
Neon provides built-in connection pooling

### CDN for Static Assets
Vercel automatically serves static files via CDN

### Database Caching
Add Redis integration (future feature)

## Security Best Practices 🔒

### Protect Sensitive Data
- Never commit `.env.local`
- Use strong NEXTAUTH_SECRET
- Enable HTTPS (automatic with Vercel)
- Validate all user inputs

### Database Security
- Use strong database passwords
- Enable SSL for connections
- Use Neon's role-based access
- Regular backups

### API Security
- Rate limiting (implement in production)
- CSRF protection (NextAuth provides)
- Input validation with Zod (implemented)
- CORS headers (if needed)

## Scaling Considerations

### When You Hit Limits

**Database:**
- Upgrade Neon plan for more connections
- Implement connection pooling
- Archive old semester data

**File Storage:**
- Use Vercel Blob or S3 for timetable uploads
- Implement cleanup for old uploads

**API Rate Limits:**
- Implement rate limiting middleware
- Cache frequently accessed data

## Development Workflow

### Making Changes

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes
# Test locally
npm run dev

# Commit
git add .
git commit -m "feat: description of changes"

# Push
git push origin feature/your-feature-name
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run lint --fix
```

### Testing (Future)

```bash
npm run test
```

## Monitoring & Logging

### Check Deployment Logs

**Vercel:**
```bash
vercel logs
```

**Local:**
```bash
npm run dev
# Check console output
```

### Error Tracking

Implement Sentry for production (future enhancement):

```bash
npm install @sentry/nextjs
```

## Useful Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run linter

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Create migration
npm run db:push          # Push schema to DB
npm run db:studio        # Open Prisma Studio
```

## Next Steps

1. ✅ Complete the setup
2. ✅ Create test account and data
3. ✅ Explore all features
4. ✅ Deploy to Vercel
5. ✅ Set up custom domain
6. ✅ Share with friends!

## Support & Resources

- **GitHub Issues**: Report bugs on GitHub
- **Neon Docs**: https://neon.tech/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **NextAuth Docs**: https://next-auth.js.org

---

**Stuck?** Email: peruswag107@gmail.com

Happy tracking! 📊✨
