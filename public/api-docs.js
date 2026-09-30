/* global SwaggerUIBundle */
SwaggerUIBundle({
  url: "/api/openapi",
  dom_id: "#swagger-ui",
  deepLinking: true,
  filter: true,
  docExpansion: "none",
  defaultModelsExpandDepth: -1,
  supportedSubmitMethods: [],
  validatorUrl: null,
  persistAuthorization: false,
  onComplete() {
    document.querySelector(".operation-filter-input")?.setAttribute("aria-label", "Filtrar operações da API");
  },
});
