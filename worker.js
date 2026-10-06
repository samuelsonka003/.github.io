const PRODUCTS = {
  led: { name: "SONSA™ Motion Light", amount: 1499 },
  organizer: { name: "SONSA™ Tech Organizer", amount: 1699 }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/checkout" && request.method === "POST") {
      try {
        const body = await request.json();
        if (!body.email || !Array.isArray(body.items) || !body.items.length) {
          return json({ error: "Neplatná objednávka." }, 400);
        }

        for (const item of body.items) {
          const product = PRODUCTS[item.id];
          if (!product) return json({ error: "Neznámy produkt." }, 400);
        }

        const params = new URLSearchParams();
        params.set("mode", "payment");
        params.set("success_url", `${url.origin}/?payment=success`);
        params.set("cancel_url", `${url.origin}/?payment=cancelled`);
        params.set("customer_email", body.email);
        params.set("billing_address_collection", "required");
        params.set("shipping_address_collection[allowed_countries][0]", "SK");
        params.set("shipping_address_collection[allowed_countries][1]", "CZ");
        params.set("shipping_address_collection[allowed_countries][2]", "AT");
        params.set("shipping_address_collection[allowed_countries][3]", "DE");

        let i = 0;
        for (const item of body.items) {
          const product = PRODUCTS[item.id];
          const quantity = Math.max(1, Math.min(20, Number(item.quantity || 1)));
          params.set(`line_items[${i}][price_data][currency]`, "eur");
          params.set(`line_items[${i}][price_data][product_data][name]`, product.name);
          params.set(`line_items[${i}][price_data][unit_amount]`, String(product.amount));
          params.set(`line_items[${i}][quantity]`, String(quantity));
          i++;
        }

        // Fixed shipping option: €3.99. Change this before launch if needed.
        params.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
        params.set("shipping_options[0][shipping_rate_data][display_name]", "Doručenie");
        params.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", "399");
        params.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "eur");

        const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: params
        });

        const data = await response.json();
        if (!response.ok) {
          return json({ error: data.error?.message || "Stripe checkout error." }, 502);
        }

        return json({ url: data.url });
      } catch (err) {
        return json({ error: "Serverová chyba checkoutu." }, 500);
      }
    }

    // Serve static files from the same Worker.
    return env.ASSETS.fetch(request);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
