### About Neomir HANA Gateway

As direct access to SAP HANA Database from your browser is technically not feasible, we've developed Neomir HANA Gateway. Its main task is, in simple terms, to act as a middleman between your HANA DB and your users while using the Neomir DQ platform.
Technically speaking, Neomir HANA Gateway is essentially a Node.js server with Express.js as middleware with a connector to HANA DB.

We decided to open-source Neomir HANA Gateway to enhance transparency, foster trust, and leverage collective intelligence in IT Security & Compliance.

### Features:

- HTTPS support with fallback to HTTP if no SSL certificates are available.
- JSON request parsing and robust CORS configuration.
- Credential encryption/decryption using AES-256-CBC.
- Promisified functions for HANA database connection and query execution.

### Environment Variables:

- HTTP_PORT: Port number for HTTP server (default: 80)
- HTTPS_PORT: Port number for HTTPS server (default: 443)
- DECRYPTION_KEY: 32-byte encryption key (hex string) for AES-256-CBC.
- DECRYPTION_IV: 16-byte initialization vector (hex string) for AES-256-CBC.

### Installation & Setup

1. **Prerequisites**

   - Git must be installed on your server
   - Node.js v22.14.0 (LTS) or higher must be installed on your server
   - You need to have an SAP HANA DB user & its password at hand

2. **Clone the repository**

   `git clone https://github.com/neomir-pe/neomir-hana-gateway.git
cd <your-repo-folder>`

3. **Install the dependencies**

   `npm install -g`

4. **Create your .env file**

   Copy the .env.template file and rename your copy to `.env.local`.

5. **Create your encryption keys**

   You will now need to create the DECRYPTION_KEY & DECRYPTION_IV. To do this, please visit:

   - https://www.random.org/cgi-bin/randbyte?nbytes=32&format=h (for DECRYPTION_KEY)
   - https://www.random.org/cgi-bin/randbyte?nbytes=16&format=h (for DECRYPTION_IV)

   Copy the randomly generated HEX-values and paste them in your `.env.local` file (without line breaks or whitespaces).

6. **Start the server**

`node index.js`

If you go to http://localhost:80 on your server's browser, you should now see a page saying "Neomir HANA Gateway Server".

7. **Encrypt your HANA DB user credentials**

   To retrieve the encrypted credentials of your SAP HANA DB user, we recommend you to use Postman to send a POST request to the /encrypt route of your server. Here's a reference:

   [https://www.postman.com/neomir-pe/workspace/neomir-hana-gateway](https://www.postman.com/neomir-pe/workspace/neomir-hana-gateway/request/37422855-2b507f14-1120-49fa-8fc1-94715f71905a?action=share&source=copy-link&creator=37422855&ctx=documentation)

   You will need these encrypted credentials to integrate with Neomir DQ - so please keep them aside for later.

### Hardware Recommendations

|             | **Minimum Requirements**              | **Medium-Scale Deployments**                           | **Large-Scale Deployments**                                                  |
| ----------- | ------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **CPU**     | 2 vCPUs                               | 4 vCPUs                                                | 8 vCPUs                                                                      |
| **RAM**     | 2 GB                                  | 8 GB                                                   | 16-32 GB                                                                     |
| **Storage** | 10 GB SSD                             | 50 GB SSD                                              | 100 GB NVMe SSD                                                              |
| **Network** | 1 Gbps                                | 1 Gbps with low-latency access to SAP HANA             | 10 Gbps                                                                      |
| **OS**      | Linux (Ubuntu 20.04+), Windows Server | Linux (Ubuntu 22.04 LTS, RHEL 8+), Windows Server 2022 | Linux (Ubuntu 22.04 LTS, RHEL 9, SUSE Enterprise Linux), Windows Server 2022 |
