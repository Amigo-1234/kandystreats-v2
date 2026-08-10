const fs = require("fs");

const FIREBASERC = ".firebaserc";
const FALLBACK_PROJECT_ID = "kandystreat-840b1";
const ORIGINS = [
  "http://127.0.0.1:5501",
  "http://localhost:5501",
  "https://kandystreat-840b1.web.app",
  "https://kandystreats.com.ng",
];

function readProjectId() {
  try {
    const config = JSON.parse(fs.readFileSync(FIREBASERC, "utf8"));
    return config.projects?.default || FALLBACK_PROJECT_ID;
  } catch (error) {
    return FALLBACK_PROJECT_ID;
  }
}

async function postCallable(projectId, functionName) {
  const url = `https://us-central1-${projectId}.cloudfunctions.net/${functionName}`;
  const preflights = [];

  for (const origin of ORIGINS) {
    const preflight = await fetch(url, {
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization,content-type,x-firebase-appcheck,x-firebase-gmpid",
      },
    });

    preflights.push({
      origin,
      status: preflight.status,
      cors: preflight.headers.get("access-control-allow-origin") || "",
    });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      origin: ORIGINS[0],
      "content-type": "application/json",
    },
    body: JSON.stringify({ data: {} }),
  });

  let body = "";
  try {
    body = await response.text();
  } catch (error) {
    body = "";
  }

  return {
    functionName,
    url,
    preflights,
    status: response.status,
    deployed: response.status !== 404,
    postCors: response.headers.get("access-control-allow-origin") || "",
    body: body.slice(0, 220),
  };
}

async function main() {
  const projectId = readProjectId();
  const requiredFunctions = [
    "ensureCustomerAccount",
    "saveCustomerAddress",
    "deleteCustomerAddress",
    "setDefaultCustomerAddress",
    "getPaymentConfigurationStatus",
    "createCheckoutOrder",
    "createGatewayPayment",
    "verifyGatewayPayment",
    "recordGatewayPaymentEvent",
    "createWalletFundingPayment",
    "verifyWalletFundingPayment",
    "payOrderWithWallet",
    "refundOrderToWallet",
    "paystackWebhook",
    "flutterwaveWebhook",
  ];

  console.log(`Checking Firebase deployment for ${projectId}...`);
  const results = [];
  for (const functionName of requiredFunctions) {
    try {
      results.push(await postCallable(projectId, functionName));
    } catch (error) {
      results.push({
        functionName,
        status: "network-error",
        deployed: false,
        body: error.message,
      });
    }
  }

  const missing = results.filter((item) => !item.deployed);
  results.forEach((item) => {
    const marker = item.deployed ? "OK" : "MISSING";
    const originStatus = item.preflights
      ? item.preflights.map((entry) => `${entry.status}/${entry.cors || "-"}`).join(",")
      : "-";
    console.log(
      `${marker.padEnd(7)} OPTIONS ${originStatus.padEnd(35)} POST ${String(item.status).padEnd(4)} ${item.functionName}`,
    );
  });

  if (missing.length) {
    console.error("");
    console.error("Firebase backend is not production-ready yet. Deploy the latest functions before testing wallet funding or checkout payments.");
    console.error("Run: npm run deploy:backend");
    process.exit(1);
  }

  console.log("");
  console.log("Firebase function endpoints are present. Authenticated payment tests can continue.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
