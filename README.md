# Capacity Exchange SDK

This repo holds client packages related to the [Capacity Exchange Service](https://github.com/SundaeSwap-finance/capacity-exchange-server).  

## Project Structure

```
.
├── packages/
│   ├── client/
│   │   ├── openapi.json                # Capacity Exchange Service OpenAPI spec
│   │   ├── generated/                  # Auto-generated OpenAPI client code
│   │   ├── tests/                      # Client tests
│   ├── components/                     # Frontend components package (uses the generated client)
│   └── example-webapp/                 # Exampe webapp (uses the components)
```

## Generating the Client

The code in `packages/client/generated` is auto-generated from the Capacity Exchange Service's OpenAPI spec. To regenerate it:

1.  **Run the service:** Bring up the [Capacity Exchange Service](https://github.com/SundaeSwap-finance/capacity-exchange-server) locally.

2.  **Download the OpenAPI spec:** Save the latest spec from the service's json docs endpoint.

    ```bash
    curl http://localhost:3000/docs/json > packages/client/openapi.json
    ```

3.  **Generate the client code:** Go to `packages/client` and run the generate script.

    ```bash
    cd packages/client
    npm run generate-client
    ```
