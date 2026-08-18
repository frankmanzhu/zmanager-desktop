use reqwest::blocking::Client;
use std::time::Duration;
use zmanager_tzap_hosted::auth_client::{
    TzapAuthError, TzapAuthHttpMethod, TzapAuthHttpRequest, TzapAuthHttpResponse,
    TzapAuthHttpTransport,
};

pub struct HostedHttpTransport {
    client: Client,
}

impl HostedHttpTransport {
    pub fn new() -> Result<Self, String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(3))
            .connect_timeout(Duration::from_secs(2))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        Ok(Self { client })
    }
}

impl TzapAuthHttpTransport for HostedHttpTransport {
    fn send(&self, request: &TzapAuthHttpRequest) -> Result<TzapAuthHttpResponse, TzapAuthError> {
        let method = match request.method {
            TzapAuthHttpMethod::Get => reqwest::Method::GET,
            TzapAuthHttpMethod::Post => reqwest::Method::POST,
        };

        let mut req = self.client.request(method, &request.url);

        if let Some(token) = &request.bearer_token {
            req = req.bearer_auth(token.expose());
        }

        if let Some(body) = &request.body {
            req = req.json(body);
        }

        let response = req.send().map_err(|e| TzapAuthError::Transport {
            message: format!("HTTP request failed: {}", e),
        })?;

        let status_code = response.status().as_u16();
        let body = response
            .bytes()
            .map_err(|e| TzapAuthError::Transport {
                message: format!("Failed to read HTTP response body: {}", e),
            })?
            .to_vec();

        Ok(TzapAuthHttpResponse { status_code, body })
    }
}
