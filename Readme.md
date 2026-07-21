This is a ticket booking project
# SeatSure — Event Booking & Ticketing System

A backend event-ticketing system built to handle the problems real booking
platforms face: preventing double-booked seats under concurrent traffic,
processing payments safely, and managing demand with a waitlist when an
event sells out.

Seats are locked atomically during checkout to eliminate race conditions,
bookings run inside MongoDB transactions, and a FIFO waitlist automatically
notifies users when seats free up from cancellations or expired holds. The
system also includes JWT auth with refresh token rotation, role-based access
control, and MongoDB aggregation pipelines for revenue and occupancy
analytics.

## Features

- 🔐 **Auth** — JWT access + refresh tokens, bcrypt password hashing, httpOnly cookies, role-based access control (`user` / `organizer` / `admin`)
- 🎟️ **Events & Shows** — organizers create events with multiple showtimes, each with its own seat layout and pricing per category
- 🔒 **Atomic seat locking** — concurrent booking attempts on the same seat are resolved safely at the database level, no double-bookings
- 💳 **Booking lifecycle** — `pending → confirmed / cancelled / expired`, backed by MongoDB transactions and a mock payment gateway
- ⏳ **Auto-expiry** — unpaid bookings and stale seat locks release automatically after a timeout
- 📋 **Waitlist** — FIFO queue that notifies the next user in line when seats free up
- 📊 **Analytics** — revenue per event, seat occupancy %, top-performing events via MongoDB aggregation pipelines
- 🖼️ **File uploads** — event banners via Multer + Cloudinary
- 🛡️ **Security** — centralized error handling, input validation, CORS configuration

## Tech Stack

| Category | Tools |
|---|---|
| Language | JavaScript (Node.js, ES Modules) |
| Framework | Express.js |
| Database | MongoDB with Mongoose |
| Auth | JWT (`jsonwebtoken`), bcrypt |
| File Storage | Multer + Cloudinary |
| Scheduling | node-cron (seat lock / waitlist expiry sweeps) |
| Dev Tools | dotenv, nodemon, Postman |

## Project Structure

```
src/
├── controllers/     # Business logic
├── models/           # Mongoose schemas
├── routes/           # Express route definitions
├── middlewares/      # Auth, file upload
├── utils/             # ApiError, ApiResponse, asyncHandler, cloudinary
├── config/                # Database connection
├── app.js             # Express app config
└── index.js           # Entry point
```


## Getting Started

### Prerequisites
- Node.js (v18+)
- A MongoDB instance (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- A [Cloudinary](https://cloudinary.com/) account (for banner image uploads)

### Installation



### Environment Setup

Copy `.env.sample` to `.env` and fill in your values:

```bash
cp .env.sample .env
```


### Run the server

```bash
npm run dev      # development, with nodemon
npm start        # production
```

Server runs at `http://localhost:8000`. Verify it's up:

```bash
curl http://localhost:8000/api/v1/healthcheck
```

## API Overview

```
/api/v1/auth          → register, login, logout, refresh-token
/api/v1/events         → create, list, update, delete events
/api/v1/events/:id/shows → create/list shows for an event
/api/v1/shows           → get show, seat map, lock/unlock seats
/api/v1/bookings         → create booking, pay, cancel
/api/v1/waitlist          → join/leave waitlist
/api/v1/analytics          → revenue, occupancy, top events
```


## Key Design Decisions

**Atomic seat locking** — instead of a read-then-write check (which race
conditions can exploit), seat locks use a single atomic `findOneAndUpdate`
per seat. Only one concurrent request can ever flip a seat from `available`
to `locked`.

**Transactional bookings** — booking creation runs inside a MongoDB session
(`mongoose.startSession`), so seat validation and booking creation succeed
or fail together — no partial writes.

**Reserve → Pay → Confirm/Release** — the booking flow mirrors how real
ticketing platforms (BookMyShow, Ticketmaster) work: seats are held
temporarily, payment is attempted within that window, and the hold releases
automatically if payment fails or the window expires.

**FIFO waitlist** — when a booking is cancelled or expires, the longest-
waiting user who can be satisfied by the newly available seats is notified
and given a claim window before the next person in line gets a turn.

## Roadmap / Possible Improvements

- [ ] Move seat-lock sweep and waitlist notifications to a job queue (BullMQ + Redis) instead of inline calls
- [ ] Real payment gateway integration (Stripe/Razorpay) in place of the mock
- [ ] Real-time seat map updates via Socket.io
- [ ] Automated test suite (Jest + Supertest)
- [ ] Rate limiting on auth and booking routes

