# Timetable Attendance Tracker 📚

A comprehensive web application to manage your academic life with timetable tracking, attendance monitoring, CGPA calculation, and event calendar management.

## Features ✨

### 🎓 Core Features Implemented

- **📅 Timetable Management**
  - Upload a timetable PDF/JPEG/PNG and list your own subjects — Gemini reads the sheet and adds only your classes, even when the source timetable lists parallel elective sections for the whole cohort
  - Manually add classes with day, time, room, and instructor details
  - View weekly timetable layout
  - Support for multiple semesters

- **✓ Attendance Tracking**
  - Track attendance on an hourly basis
  - Monitor attendance percentage in real-time
  - Automatic calculation of leaves available based on 80% requirement
  - Visual attendance charts and statistics
  - Add notes to attendance records

- **📊 CGPA Calculator**
  - Calculate CGPA on a 4.0 scale
  - Track grades for individual courses
  - Calculate grade points based on credit hours
  - Support for course-wise percentage grades
  - Visual grade distribution charts

- **🗓️ Calendar & Events**
  - Mark important dates (exams, assignments, deadlines)
  - Color-coded event types (exam, assignment, deadline, holiday)
  - Monthly calendar view with event display
  - Upcoming events sidebar
  - Easy event creation and management

- **📱 User Features**
  - User registration and authentication
  - Multi-semester management
  - Personal dashboard with key statistics
  - Course management
  - Data persistence across sessions

## Tech Stack 🛠️

- **Frontend**: Next.js 14, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: PostgreSQL (via Neon)
- **ORM**: Prisma
- **Authentication**: NextAuth.js
- **Charts**: Recharts
- **Validation**: Zod
- **Deployment**: Vercel

## Getting Started 🚀

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database (Neon recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/peru-107/timetable.git
   cd timetable
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Set up environment variables**
   ```bash
   # Copy the example file
   cp .env.example .env.local
   
   # Edit .env.local with your database credentials
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Key Calculations 📐

### Attendance (80% requirement)
- Available leaves = (80% of total hours - Attended hours) / 2 hours per class
- Status updates in real-time

### CGPA Calculation
```
CGPA = Σ(Grade × Credit Hours) / Σ(Credit Hours)
```

## Deployment 🌐

Deploy easily to Vercel:

```bash
git push origin claude/timetable-attendance-tracker-m2um3x
```

Then connect to Vercel and set environment variables.

## Troubleshooting 🔧

- **Database issues**: Check DATABASE_URL in .env.local
- **Large files**: Use Vercel Blob for production
- **Auth issues**: Clear cookies and try again

---

Made with ❤️ for students to manage their academic life better.
