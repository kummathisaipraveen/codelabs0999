# 🧪 CodeCoach Manual Testing Checklist

> App URL: **http://localhost:8080/** | Backend: **http://localhost:8000/**
> Login: `psai78132@gmail.com` / `Sai@2004`

---

## 1. 🔐 Authentication

| # | What to Check | How to Check | Expected | ✅/❌ |
|---|---|---|---|---|
| 1.1 | Login works | Go to `/auth`, enter creds, click Sign In | Redirected to dashboard | |
| 1.2 | Session persists | Refresh page after login | Still logged in | |
| 1.3 | Logout works | Click avatar/logout from Navbar | Redirected to login | |

---

## 2. 📚 Problem Library (`/problems`)

| # | What to Check | How to Check | Expected | ✅/❌ |
|---|---|---|---|---|
| 2.1 | Problems load | Go to `/problems` | List of problems displayed (not blank) | |
| 2.2 | Can click a problem | Click any problem card | Redirects to `/practice/:id` | |
| 2.3 | Filtering works | Try filtering by difficulty/topic | List updates accordingly | |

---

## 3. 💻 Code Practice (`/practice/:id`)

| # | What to Check | How to Check | Expected | ✅/❌ |
|---|---|---|---|---|
| 3.1 | Problem statement loads | Go to `/practice/1` | Problem description is visible | |
| 3.2 | Code editor works | Type `print("Hello")` in the editor | Code appears in editor | |
| 3.3 | Code execution works | Click **Run** button | Shows output section with test results | |
| 3.4 | Chatbot works | Open chat, type **"help me with this"** | Socratic response appears | |
| 3.5 | Hints work | Click **Need a Hint?** button | Hint Level 1 message appears | |
| 3.6 | Progressive hints | Click hint again | Different/deeper hint appears | |

---

## 4. 📊 Dashboard (`/dashboard`)

| # | What to Check | How to Check | Expected | ✅/❌ |
|---|---|---|---|---|
| 4.1 | Dashboard loads | Go to `/dashboard` | Stats/cards are displayed | |
| 4.2 | Mastery graph shows | Look for skill graph section | Graph is rendered (no blank area) | |
| 4.3 | Activity is logged | Practice a problem, come back | Recent activity is updated | |
| 4.4 | Assignments shown | Check assignments section | Shows pending or completed assignments | |

---

## 5. 🏆 Leaderboard (`/leaderboard`)

| # | What to Check | How to Check | Expected | ✅/❌ |
|---|---|---|---|---|
| 5.1 | Leaderboard loads | Go to `/leaderboard` | Student rankings are shown | |
| 5.2 | Your name appears | Check after solving a problem | Your entry visible in list | |

---

## 6. 👤 Profile (`/profile`)

| # | What to Check | How to Check | Expected | ✅/❌ |
|---|---|---|---|---|
| 6.1 | Profile page loads | Go to `/profile` | Your name/email shown | |
| 6.2 | Stats visible | Check stats/scores | Problem count & points displayed | |

---

## 7. 🛡️ Anti-Cheat (Background — Hard to See)

| # | What to Check | How to Check | Expected | ✅/❌ |
|---|---|---|---|---|
| 7.1 | No errors on tab switch | Switch to another tab while on practice page, switch back | No error in browser console | |
| 7.2 | Copy-paste detection | Paste a large block of code quickly | Backend logs a security event (check terminal) | |

---

## 📝 How to Report Issues

After testing, tell me:
1. The **row number** (e.g., 3.3, 4.2)
2. What you **saw** instead of the expected result
3. Any **error messages** shown on screen or in the terminal

---

> **Remember**: You also need to run the SQL migration for full functionality:
> Copy the SQL from `supabase/migrations/20260322_ontology_tables.sql` into your [Supabase SQL Editor](https://supabase.com/dashboard/project/eeyvtnprdyzcbfqusewa/sql/new) and click Run.
