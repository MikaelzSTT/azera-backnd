require("dotenv").config();

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000", process.env.FRONTEND_URL].filter(Boolean),
    credentials: true,
  })
);

app.use(express.json());

/* =========================
   MONGODB
========================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Mongo conectado 🚀");
  })
  .catch((error) => {
    console.error("Erro ao conectar no Mongo:", error);
    process.exit(1);
  });

/* =========================
   MODELS
========================= */
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const businessSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    googleReviewUrl: {
      type: String,
      required: true,
      trim: true,
    },
    logoUrl: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

const feedbackSchema = new mongoose.Schema(
  {
    businessSlug: {
      type: String,
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

const scanSchema = new mongoose.Schema(
  {
    businessSlug: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

const googleReviewSchema = new mongoose.Schema(
  {
    businessSlug: {
      type: String,
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const Business = mongoose.model("Business", businessSchema);
const Feedback = mongoose.model("Feedback", feedbackSchema);
const Scan = mongoose.model("Scan", scanSchema);
const GoogleReview = mongoose.model("GoogleReview", googleReviewSchema);

/* =========================
   EMAIL
========================= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* =========================
   ROOT
========================= */
app.get("/", (req, res) => {
  res.json({
    message: "Review SaaS Backend Running 🚀",
  });
});

/* =========================
   USERS
========================= */
app.get("/users", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    const safeUsers = users.map((user) => ({
      id: user._id.toString(),
      email: user.email,
      createdAt: user.createdAt,
    }));

    res.json(safeUsers);
  } catch (error) {
    console.error("Erro ao buscar users:", error);
    res.status(500).json({ error: "Failed to load users" });
  }
});

app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        error: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
    });

    return res.status(201).json({
      message: "User created successfully",
      user: {
        id: newUser._id.toString(),
        email: newUser.email,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error("Erro no signup:", error);
    return res.status(500).json({
      error: "Failed to create user",
    });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    return res.json({
      message: "Login successful",
      user: {
        id: user._id.toString(),
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({
      error: "Failed to login",
    });
  }
});

/* =========================
   BUSINESSES
========================= */
app.get("/businesses", async (req, res) => {
  try {
    const { userId } = req.query;

    if (userId) {
      const filteredBusinesses = await Business.find({ userId }).sort({
        createdAt: -1,
      });

      return res.json(
        filteredBusinesses.map((item) => ({
          id: item._id.toString(),
          userId: item.userId,
          name: item.name,
          slug: item.slug,
          googleReviewUrl: item.googleReviewUrl,
          logoUrl: item.logoUrl || "",
          createdAt: item.createdAt,
        }))
      );
    }

    const businesses = await Business.find().sort({ createdAt: -1 });

    return res.json(
      businesses.map((item) => ({
        id: item._id.toString(),
        userId: item.userId,
        name: item.name,
        slug: item.slug,
        googleReviewUrl: item.googleReviewUrl,
        logoUrl: item.logoUrl || "",
        createdAt: item.createdAt,
      }))
    );
  } catch (error) {
    console.error("Erro ao buscar businesses:", error);
    return res.status(500).json({
      error: "Failed to load businesses",
    });
  }
});

app.get("/businesses/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const business = await Business.findOne({ slug: slug.toLowerCase() });

    if (!business) {
      return res.status(404).json({
        error: "Business not found",
      });
    }

    return res.json({
      id: business._id.toString(),
      userId: business.userId,
      name: business.name,
      slug: business.slug,
      googleReviewUrl: business.googleReviewUrl,
      logoUrl: business.logoUrl || "",
      createdAt: business.createdAt,
    });
  } catch (error) {
    console.error("Erro ao buscar business por slug:", error);
    return res.status(500).json({
      error: "Failed to load business",
    });
  }
});

app.post("/businesses", async (req, res) => {
  try {
    const { name, slug, googleReviewUrl, userId, logoUrl } = req.body;

    if (!name || !slug || !googleReviewUrl || !userId) {
      return res.status(400).json({
        error: "Name, slug, googleReviewUrl and userId are required",
      });
    }

    let userExists = null;

if (mongoose.Types.ObjectId.isValid(userId)) {
  userExists = await User.findById(userId);
}

if (!userExists) {
  userExists = await User.findOne({ id: userId });
}

if (!userExists) {
  return res.status(400).json({
    error: "Invalid userId",
  });
}

const normalizedSlug = slug.trim().toLowerCase();
const ownerId = userExists._id.toString();

const existingBusiness = await Business.findOne({
  slug: normalizedSlug,
  userId: ownerId,
});

if (existingBusiness) {
  return res.status(400).json({
    error: "You already have a business with this slug",
  });
}

const newBusiness = await Business.create({
  userId: ownerId,
  name: name.trim(),
  slug: normalizedSlug,
  googleReviewUrl: googleReviewUrl.trim(),
  logoUrl: logoUrl || "",
});

    return res.status(201).json({
      id: newBusiness._id.toString(),
      userId: newBusiness.userId,
      name: newBusiness.name,
      slug: newBusiness.slug,
      googleReviewUrl: newBusiness.googleReviewUrl,
      logoUrl: newBusiness.logoUrl || "",
      createdAt: newBusiness.createdAt,
    });
  } catch (error) {
    console.error("Erro ao criar business:", error);
    return res.status(500).json({
      error: "Failed to save business",
    });
  }
});

/* =========================
   FEEDBACK
========================= */
app.get("/feedback", async (req, res) => {
  try {
    const { userId } = req.query;

    if (userId) {
      const userBusinesses = await Business.find({ userId }).select("slug");
      const userBusinessSlugs = userBusinesses.map((business) => business.slug);

      const filteredFeedbacks = await Feedback.find({
        businessSlug: { $in: userBusinessSlugs },
      }).sort({ createdAt: -1 });

      return res.json(
        filteredFeedbacks.map((item) => ({
          id: item._id.toString(),
          businessSlug: item.businessSlug,
          rating: item.rating,
          message: item.message || "",
          createdAt: item.createdAt,
        }))
      );
    }

    const feedbacks = await Feedback.find().sort({ createdAt: -1 });

    return res.json(
      feedbacks.map((item) => ({
        id: item._id.toString(),
        businessSlug: item.businessSlug,
        rating: item.rating,
        message: item.message || "",
        createdAt: item.createdAt,
      }))
    );
  } catch (error) {
    console.error("Erro ao buscar feedbacks:", error);
    return res.status(500).json({
      error: "Failed to load feedbacks",
    });
  }
});

app.post("/feedback", async (req, res) => {
  try {
    const { businessSlug, rating, message } = req.body;

    if (!businessSlug || !rating) {
      return res.status(400).json({
        error: "businessSlug and rating are required",
      });
    }

    const normalizedSlug = businessSlug.trim().toLowerCase();

    const businessExists = await Business.findOne({ slug: normalizedSlug });

    if (!businessExists) {
      return res.status(400).json({
        error: "Business does not exist",
      });
    }

    const newFeedback = await Feedback.create({
      businessSlug: normalizedSlug,
      rating: Number(rating),
      message: message || "",
    });

    if (Number(rating) <= 3) {
      try {
        const business = await Business.findOne({ slug: normalizedSlug });
        const owner = await User.findById(business.userId);

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

    return res.status(201).json({
      id: newFeedback._id.toString(),
      businessSlug: newFeedback.businessSlug,
      rating: newFeedback.rating,
      message: newFeedback.message || "",
      createdAt: newFeedback.createdAt,
    });
  } catch (error) {
    console.error("Erro ao criar feedback:", error);
    return res.status(500).json({
      error: "Failed to save feedback",
    });
  }
});

/* =========================
   SCANS
========================= */
app.get("/scans", async (req, res) => {
  try {
    const { userId } = req.query;

    if (userId) {
      const userBusinesses = await Business.find({ userId }).select("slug");
      const userBusinessSlugs = userBusinesses.map((business) => business.slug);

      const filteredScans = await Scan.find({
        businessSlug: { $in: userBusinessSlugs },
      }).sort({ createdAt: -1 });

      return res.json(
        filteredScans.map((item) => ({
          id: item._id.toString(),
          businessSlug: item.businessSlug,
          createdAt: item.createdAt,
        }))
      );
    }

    const scans = await Scan.find().sort({ createdAt: -1 });

    return res.json(
      scans.map((item) => ({
        id: item._id.toString(),
        businessSlug: item.businessSlug,
        createdAt: item.createdAt,
      }))
    );
  } catch (error) {
    console.error("Erro ao buscar scans:", error);
    return res.status(500).json({
      error: "Failed to load scans",
    });
  }
});

app.post("/scans", async (req, res) => {
  try {
    const { businessSlug } = req.body;

    if (!businessSlug) {
      return res.status(400).json({
        error: "businessSlug is required",
      });
    }

    const normalizedSlug = businessSlug.trim().toLowerCase();

    const businessExists = await Business.findOne({ slug: normalizedSlug });

    if (!businessExists) {
      return res.status(400).json({
        error: "Business does not exist",
      });
    }

    const newScan = await Scan.create({
      businessSlug: normalizedSlug,
    });

    return res.status(201).json({
      id: newScan._id.toString(),
      businessSlug: newScan.businessSlug,
      createdAt: newScan.createdAt,
    });
  } catch (error) {
    console.error("Erro ao criar scan:", error);
    return res.status(500).json({
      error: "Failed to save scan",
    });
  }
});

/* =========================
   GOOGLE REVIEWS
========================= */
app.get("/google-reviews", async (req, res) => {
  try {
    const { userId } = req.query;

    if (userId) {
      const userBusinesses = await Business.find({ userId }).select("slug");
      const userBusinessSlugs = userBusinesses.map((business) => business.slug);

      const filteredGoogleReviews = await GoogleReview.find({
        businessSlug: { $in: userBusinessSlugs },
      }).sort({ createdAt: -1 });

      return res.json(
        filteredGoogleReviews.map((item) => ({
          id: item._id.toString(),
          businessSlug: item.businessSlug,
          rating: item.rating,
          createdAt: item.createdAt,
        }))
      );
    }

    const googleReviews = await GoogleReview.find().sort({ createdAt: -1 });

    return res.json(
      googleReviews.map((item) => ({
        id: item._id.toString(),
        businessSlug: item.businessSlug,
        rating: item.rating,
        createdAt: item.createdAt,
      }))
    );
  } catch (error) {
    console.error("Erro ao buscar google reviews:", error);
    return res.status(500).json({
      error: "Failed to load google reviews",
    });
  }
});

app.post("/google-reviews", async (req, res) => {
  try {
    const { businessSlug, rating } = req.body;

    if (!businessSlug || !rating) {
      return res.status(400).json({
        error: "businessSlug and rating are required",
      });
    }

    const normalizedSlug = businessSlug.trim().toLowerCase();

    const businessExists = await Business.findOne({ slug: normalizedSlug });

    if (!businessExists) {
      return res.status(400).json({
        error: "Business does not exist",
      });
    }

    const newGoogleReview = await GoogleReview.create({
      businessSlug: normalizedSlug,
      rating: Number(rating),
    });

    return res.status(201).json({
      id: newGoogleReview._id.toString(),
      businessSlug: newGoogleReview.businessSlug,
      rating: newGoogleReview.rating,
      createdAt: newGoogleReview.createdAt,
    });
  } catch (error) {
    console.error("Erro ao criar google review:", error);
    return res.status(500).json({
      error: "Failed to save google review",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});