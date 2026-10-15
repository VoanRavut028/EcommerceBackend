# Ecommerce Backend

A Node.js, Express, TypeScript, and MongoDB backend for an e-commerce application.

This project is currently under active development and includes authentication, user profile support, and OAuth login flows. More e-commerce features will be added over time.

## Features

### Currently implemented
- User registration flow with OTP verification
- Login and authentication
- JWT access token and refresh token support
- Profile retrieval endpoint
- Google and GitHub OAuth integration
- MongoDB connection and user models
- Cookie-based refresh token handling

### Planned / upcoming
- Product management
- Category and cart management
- Wishlist and reviews
- Orders and payments
- Coupons and notifications
- Admin dashboard APIs

## Tech Stack
- Node.js
- Express.js
- TypeScript
- MongoDB + Mongoose
- JWT for authentication
- Passport.js for OAuth
- Cookie parser and CORS support

## Project Structure

```bash
src/
  app.ts
  index.ts
  configs/
  controllers/
  interfaces/
  middlewares/
  models/
  routes/
  services/
  utils/
```

## Prerequisites
- Node.js (v18 or higher recommended)
- MongoDB running locally or remotely
- A `.env` file with the required environment variables

## Installation

1. Clone the repository
   ```bash
   git clone <your-repository-url>
   cd EcommerceBackend
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and add the required variables.

## Environment Variables

Example variables you should configure:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

MONGODB_URL=mongodb://127.0.0.1:27017/ecommerce
# or MONGO_URI=your_mongo_connection_string

JWT_SECRET=your_access_token_secret
JWT_EXPIRE=1d
JWT_REFRESH_SECRET=your_refresh_token_secret
JWT_REFRESH_TOKEN_EXPIRE=7d
JWT_ISSUER=ecommerce-backend

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:5000/api/v1/auth/github/callback

REGISTRATION_TICKET_SECRET=your_registration_secret

FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Admin product images can be uploaded with `POST /api/v1/products/images` as
`multipart/form-data` using the `image` field. The response contains `url` and
`public_id`; include both in a product image object when creating or updating a
product. Keep the Cloudinary API secret on the backend only.

## Running the Server

Development mode:
```bash
npm run dev
```

Production build:
```bash
npm run build
npm start
```

## API Routes

### Auth
- `POST /api/v1/register/init`
- `POST /api/v1/register/verify`
- `POST /api/v1/register`
- `POST /api/v1/login`
- `POST /api/v1/refresh`
- `GET /api/v1/profile`

### OAuth
- `GET /api/v1/auth/google`
- `GET /api/v1/auth/google/callback`
- `GET /api/v1/auth/github`
- `GET /api/v1/auth/github/callback`

## Notes

This repository is being built step by step as a backend foundation for an ecommerce platform. The README will be updated regularly as more features are implemented.

## License

ISC
