import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Maps the amount charged (in pence) to a plan tier.
// Update these if you ever change your Stripe prices.
const AMOUNT_TO_TIER = {
  500: "starter",
  1000: "growth",
  2000: "pro",
};

function monthKey() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const signature = req.headers["stripe-signature"];
  const rawBody = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    res.status(400).send(`Webhook signature verification failed: ${err.message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const businessId = session.client_reference_id;
    const tier = AMOUNT_TO_TIER[session.amount_total];

    if (businessId && tier) {
      const { error } = await supabaseAdmin
        .from("businesses")
        .update({ tier, month_key: monthKey(), reviews_this_month: 0 })
        .eq("id", businessId);

      if (error) {
        console.error("Failed to upgrade business after payment:", error);
        res.status(500).send("Database update failed");
        return;
      }
    } else {
      console.error("Missing businessId or unrecognised amount:", businessId, session.amount_total);
    }
  }

  res.status(200).json({ received: true });
}
