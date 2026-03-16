require("dotenv").config();

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
  })
);

app.use(express.json());

const users = [];
const businesses = [];
const feedbacks = [];
const scans = [];
const googleReviews = [];

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.get("/", (req, res) => {
  res.json({
    message: "Review SaaS Backend Running 🚀",
  });
});

app.get("/users", (req, res) => {
  const safeUsers = users.map((user) => ({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
  }));

  res.json(safeUsers);
});

app.post("/signup", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password are required",
    });
  }

  const existingUser = users.find((user) => user.email === email);

  if (existingUser) {
    return res.status(400).json({
      error: "User already exists",
    });
  }

  const newUser = {
    id: Date.now().toString(),
    email,
    password,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);

  return res.status(201).json({
    message: "User created successfully",
    user: {
      id: newUser.id,
      email: newUser.email,
      createdAt: newUser.createdAt,
    },
  });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password are required",
    });
  }

  const user = users.find(
    (item) => item.email === email && item.password === password
  );

  if (!user) {
    return res.status(401).json({
      error: "Invalid email or password",
    });
  }

  return res.json({
    message: "Login successful",
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    },
  });
});

app.get("/businesses", (req, res) => {
  const { userId } = req.query;

  if (userId) {
    const filteredBusinesses = businesses.filter(
      (item) => item.userId === userId
    );
    return res.json(filteredBusinesses);
  }

  return res.json(businesses);
});

app.get("/businesses/:slug", (req, res) => {
  const { slug } = req.params;

  const business = businesses.find((item) => item.slug === slug);

  if (!business) {
    return res.status(404).json({
      error: "Business not found",
    });
  }

  return res.json(business);
});

app.post("/businesses", (req, res) => {
  const { name, slug, googleReviewUrl, userId, logoUrl } = req.body;

  if (!name || !slug || !googleReviewUrl || !userId) {
    return res.status(400).json({
      error: "Name, slug, googleReviewUrl and userId are required",
    });
  }

  const userExists = users.find((user) => user.id === userId);

  if (!userExists) {
    return res.status(400).json({
      error: "Invalid userId",
    });
  }

  const existingBusiness = businesses.find(
    (item) => item.slug === slug && item.userId === userId
  );

  if (existingBusiness) {
    return res.status(400).json({
      error: "You already have a business with this slug",
    });
  }

  const newBusiness = {
    id: Date.now().toString(),
    userId,
    name,
    slug,
    googleReviewUrl,
    logoUrl: logoUrl || "",
    createdAt: new Date().toISOString(),
  };

  businesses.push(newBusiness);

  return res.status(201).json(newBusiness);
});

app.get("/feedback", (req, res) => {
  const { userId } = req.query;

  if (userId) {
    const userBusinessSlugs = businesses
      .filter((business) => business.userId === userId)
      .map((business) => business.slug);

    const filteredFeedbacks = feedbacks.filter((item) =>
      userBusinessSlugs.includes(item.businessSlug)
    );

    return res.json(filteredFeedbacks);
  }

  return res.json(feedbacks);
});

app.post("/feedback", async (req, res) => {
  const { businessSlug, rating, message } = req.body;

  if (!businessSlug || !rating) {
    return res.status(400).json({
      error: "businessSlug and rating are required",
    });
  }

  const businessExists = businesses.find((item) => item.slug === businessSlug);

  if (!businessExists) {
    return res.status(400).json({
      error: "Business does not exist",
    });
  }

  const newFeedback = {
    id: Date.now().toString(),
    businessSlug,
    rating,
    message: message || "",
    createdAt: new Date().toISOString(),
  };

  feedbacks.push(newFeedback);

  if (Number(rating) <= 3) {
    try {
      const business = businesses.find((b) => b.slug === businessSlug);
      const owner = users.find((u) => u.id === business.userId);
      const dashboardUrl = process.env.FRONTEND_URL
        ? `${process.env.FRONTEND_URL}/dashboard`
        : "http://localhost:3000/dashboard";

      if (owner) {
        await transporter.sendMail({
          from: `Azera Alerts <${process.env.EMAIL_USER}>`,
          to: owner.email,
          subject: `⚠️ New negative feedback for ${business.name}`,
          html: `
            <div style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
              <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
                <div style="background:#111111;border-radius:18px;padding:32px;border:1px solid #27272a;">
                  <div style="margin-bottom:24px;">
                    <p style="margin:0;color:#a1a1aa;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">
                      Azera Alerts
                    </p>
                    <h1 style="margin:10px 0 0 0;color:#ffffff;font-size:28px;line-height:1.2;">
                      New negative feedback received
                    </h1>
                  </div>

                  <div style="background:#18181b;border:1px solid #27272a;border-radius:14px;padding:20px;margin-bottom:20px;">
                    <p style="margin:0 0 12px 0;color:#ffffff;font-size:15px;">
                      A customer left low-rated feedback for your business.
                    </p>

                    <p style="margin:8px 0;color:#d4d4d8;font-size:14px;">
                      <strong style="color:#ffffff;">Business:</strong> ${business.name}
                    </p>

                    <p style="margin:8px 0;color:#d4d4d8;font-size:14px;">
                      <strong style="color:#ffffff;">Slug:</strong> ${business.slug}
                    </p>

                    <p style="margin:8px 0;color:#d4d4d8;font-size:14px;">
                      <strong style="color:#ffffff;">Rating:</strong> ${rating} star(s)
                    </p>
                  </div>

                  <div style="background:#18181b;border:1px solid #27272a;border-radius:14px;padding:20px;margin-bottom:24px;">
                    <p style="margin:0 0 10px 0;color:#ffffff;font-size:14px;font-weight:bold;">
                      Customer message
                    </p>

                    <p style="margin:0;color:#e4e4e7;font-size:15px;line-height:1.6;">
                      ${message || "No message provided"}
                    </p>
                  </div>

                  <div style="margin-top:24px;">
                    <a
                      href="${dashboardUrl}"
                      style="display:inline-block;background:#ffffff;color:#111111;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold;font-size:14px;"
                    >
                      Open Azera Dashboard
                    </a>
                  </div>

                  <div style="margin-top:28px;padding-top:20px;border-top:1px solid #27272a;">
                    <p style="margin:0;color:#71717a;font-size:12px;">
                      Azera Review Monitoring System
                    </p>
                  </div>
                </div>
              </div>
            </div>
          `,
        });

        console.log(`Negative feedback alert email sent to ${owner.email}`);
      }
    } catch (error) {
      console.error("Failed to send negative feedback email:", error);
    }
  }

  return res.status(201).json(newFeedback);
});

app.get("/scans", (req, res) => {
  const { userId } = req.query;

  if (userId) {
    const userBusinessSlugs = businesses
      .filter((business) => business.userId === userId)
      .map((business) => business.slug);

    const filteredScans = scans.filter((item) =>
      userBusinessSlugs.includes(item.businessSlug)
    );

    return res.json(filteredScans);
  }

  return res.json(scans);
});

app.post("/scans", (req, res) => {
  const { businessSlug } = req.body;

  if (!businessSlug) {
    return res.status(400).json({
      error: "businessSlug is required",
    });
  }

  const businessExists = businesses.find((item) => item.slug === businessSlug);

  if (!businessExists) {
    return res.status(400).json({
      error: "Business does not exist",
    });
  }

  const newScan = {
    id: Date.now().toString(),
    businessSlug,
    createdAt: new Date().toISOString(),
  };

  scans.push(newScan);

  return res.status(201).json(newScan);
});

app.get("/google-reviews", (req, res) => {
  const { userId } = req.query;

  if (userId) {
    const userBusinessSlugs = businesses
      .filter((business) => business.userId === userId)
      .map((business) => business.slug);

    const filteredGoogleReviews = googleReviews.filter((item) =>
      userBusinessSlugs.includes(item.businessSlug)
    );

    return res.json(filteredGoogleReviews);
  }

  return res.json(googleReviews);
});

app.post("/google-reviews", (req, res) => {
  const { businessSlug, rating } = req.body;

  if (!businessSlug || !rating) {
    return res.status(400).json({
      error: "businessSlug and rating are required",
    });
  }

  const businessExists = businesses.find((item) => item.slug === businessSlug);

  if (!businessExists) {
    return res.status(400).json({
      error: "Business does not exist",
    });
  }

  const newGoogleReview = {
    id: Date.now().toString(),
    businessSlug,
    rating,
    createdAt: new Date().toISOString(),
  };

  googleReviews.push(newGoogleReview);

  return res.status(201).json(newGoogleReview);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});