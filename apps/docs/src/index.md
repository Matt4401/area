---
layout: home
hero:
  name: AREA
  text: Developer docs
  tagline: An IFTTT/Zapier-style automation platform. Actions in one service trigger REActions in another, assembled as workflows.
  actions:
    - theme: brand
      text: MVP scope
      link: /mvp
    - theme: alt
      text: Architecture decisions
      link: /adr/
    - theme: alt
      text: GitHub
      link: https://github.com/Matt4401/area
features:
  - icon: 🧩
    title: Microservices on Kubernetes
    details: One service per connector, one database per service, with RabbitMQ between core and connectors.
    link: /adr/0001-service-granularity
    linkText: Service granularity
  - icon: 🛠️
    title: NestJS, Vue 3 and PostgreSQL
    details: Back end, web client with the workflow Builder, and persistence, each recorded with the alternatives considered.
    link: /adr/0002-backend-framework
    linkText: Back-end framework
  - icon: 🎯
    title: What the MVP delivers
    details: GitHub and Discord connectors, an end-to-end workflow with a condition, and how each claim can be checked.
    link: /mvp
    linkText: MVP scope
  - icon: 📝
    title: Decisions as ADRs
    details: Every significant choice has context, options, consequences and a status. Browse them all with their dates.
    link: /adr/
    linkText: All ADRs
---
