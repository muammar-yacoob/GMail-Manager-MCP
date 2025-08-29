# 📋 Changelog

All notable changes to **Gmail Manager MCP** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.6](https://github.com/muammar-yacoob/GMail-Manager-MCP/compare/v1.1.5...v1.1.6) (2025-08-29)


### Bug Fixes

* readme and npm package scope ([16fe343](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/16fe3437487f36de4f55bacdb1fb6aa12b525c55))

## [1.1.5](https://github.com/muammar-yacoob/GMail-Manager-MCP/compare/v1.1.4...v1.1.5) (2025-08-29)


### Bug Fixes

* remove unnecessary files from git tracking ([9ac3e98](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/9ac3e98eafa27c2f0ffb999733e9452493febf01))

## [1.1.4](https://github.com/muammar-yacoob/GMail-Manager-MCP/compare/v1.1.3...v1.1.4) (2025-08-29)


### Bug Fixes

* remove gcp-oauth.keys.json from tracking and clean up .gitignore ([9c4e145](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/9c4e145d51ee28ff00073bf67ffbd7fb59ca82fc))
* resolve import.meta.url CommonJS compatibility issue for Smithery deployment ([60b34de](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/60b34def343847146782eeeea9bf0e43de33bfed))

## [1.1.3](https://github.com/muammar-yacoob/GMail-Manager-MCP/compare/v1.1.2...v1.1.3) (2025-08-29)


### Bug Fixes

* improve authentication flow and error messages for Claude Desktop ([0836e35](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/0836e358ac39aeadb413f1871a1276ea799f491a))
* resolve Smithery port conflict by using http mode and preventing dual server startup ([73a23f1](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/73a23f10bf0baf89ad883c1f7ad38bdda903b8d4))

## [1.1.2](https://github.com/muammar-yacoob/GMail-Manager-MCP/compare/v1.1.1...v1.1.2) (2025-08-29)


### Bug Fixes

* add default export for Smithery compatibility ([c3f0e2f](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/c3f0e2f872f9338f489f192c26e311488d4c14c1))
* remove import.meta usage for CommonJS compatibility in Smithery deployments ([31feede](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/31feedec26afbb53b84edac5c0ebe1454f184ace))
* remove unnecessary import.meta type check preventing server startup ([4ddd77b](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/4ddd77b5ebb0989022b439452aa9ba8477f64702))
* smithery export format for stateful server compatibility ([e80dc2f](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/e80dc2fda97d148157112a5049d362becc66e955))

## [1.1.1](https://github.com/muammar-yacoob/GMail-Manager-MCP/compare/v1.1.0...v1.1.1) (2025-08-28)


### Bug Fixes

* auth and local test ([aa44722](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/aa447226f8b5da01f34dee5dd51a1c606b64e24b))
* resolve open package container compatibility for Smithery deployment ([9f89495](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/9f89495bb59b2d14c67e7e868c8cde6a75c26476))

# [1.1.0](https://github.com/muammar-yacoob/GMail-Manager-MCP/compare/v1.0.9...v1.1.0) (2025-08-28)


### Bug Fixes

* suppress startup messages and handle missing credentials ([0adfbfc](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/0adfbfceec41e48b2ecbdd3e0d748efb060bd57a))
* suppress startup messages and handle missing credentials gracefully for Smithery scanning compatibility ([3cca323](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/3cca323b67edfe1394f374c05e8b399a72c6fd50))
* suppress startup messages in production for Smithery scanning compatibility ([23e28ef](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/23e28ef317528b1f23aa93f221d64b04b3923a8c))


### Features

* add HTTP server support for container deployments while maintaining stdio compatibility ([bb15f1b](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/bb15f1b59aae63fe143c6d5826ea0f2abe22a6ce))

## [1.0.9](https://github.com/muammar-yacoob/GMail-Manager-MCP/compare/v1.0.8...v1.0.9) (2025-08-27)


### Bug Fixes

* add npm package preparation & Git-based installation options ([fe5267a](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/fe5267a170ddccfd8745606f36e59b97859e9a96))
* enhance UX with pre-auth CLI & copy-friendly ([188fa50](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/188fa50fb6c65a889d85e6ac291e2e37b005d947))

## [1.0.8](https://github.com/muammar-yacoob/GMail-Manager-MCP/compare/v1.0.7...v1.0.8) (2025-08-27)


### Bug Fixes

* handle missing credentials gracefully for Smithery deployment ([991ea64](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/991ea64392da1f0d80d91ea17438a463d0ef8a7b))
* resolve TypeScript compilation errors for Smithery deployment ([5c36e03](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/5c36e03f6dc9a206fa6f5ee80e69909e083c373e))
* update MCP server to properly handle initialization & deployment ([713eb03](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/713eb03b66663fc6b3ebfc0602137819583948a4))

## [1.0.7](https://github.com/muammar-yacoob/GMail-Manager-MCP/compare/v1.0.6...v1.0.7) (2025-08-27)


### Bug Fixes

* make smithery oauth configuration optional for scanning ([5c57e99](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/5c57e99597180697950d639a84a62db77819742c))
* prioritize local oauth keys file for Smithery compatibility ([57acaab](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/57acaab7526f724eadfc67b55d6a6267e3f200be))

## [1.0.6](https://github.com/muammar-yacoob/GMail-Manager-MCP/compare/v1.0.5...v1.0.6) (2025-08-27)


### Bug Fixes

* prevent auth module browser open failure in headless environments ([43d0e61](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/43d0e61d660623939b75b2f747475acd145c49fe))

## [1.0.5](https://github.com/muammar-yacoob/GMail-Manager-MCP/compare/v1.0.4...v1.0.5) (2025-08-27)


### Bug Fixes

* setting remote to false ([2fa6fa3](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/2fa6fa3cadc84041c1e342285ca4a96c8d96cc34))
* update Dockerfile and workflow for Smithery compatibility ([37b6cde](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/37b6cde5d2f43193099a3c79948b654db021c485))
* update MCP server to properly handle initialization protocol ([66f0c6f](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/66f0c6ffa4cd52352212e3ea156007b194771d8c))

# 📋 Changelog

All notable changes to **Gmail Manager MCP** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.4](https://github.com/muammar-yacoob/GMail-Manager-MCP/compare/v1.0.3...v1.0.4) (2025-08-27)


### Bug Fixes

* update Dockerfile and workflow for Smithery compatibility ([57054a1](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/57054a18c438f27f62c8bba5cd13328543f34658))

## [1.0.3](https://github.com/muammar-yacoob/GMail-Manager-MCP/compare/v1.0.2...v1.0.3) (2025-08-27)


### Bug Fixes

* add module field to package.json for Smithery CLI compatibility ([c40894d](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/c40894dc310d637347166d16ab8f2e3a21ccb3fc))

## [1.0.2](https://github.com/muammar-yacoob/GMail-Manager-MCP/compare/v1.0.1...v1.0.2) (2025-08-27)


### Bug Fixes

* add HTTP transport support for Smithery deployment ([46d7d2e](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/46d7d2e4bdc4963b94b5aa57e7fe2f221f5749a0))
* simplify server transport & update smithery config ([2e856b4](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/2e856b46366b6b4d10c58067ef30139b974554ff))

## [1.0.1](https://github.com/muammar-yacoob/GMail-Manager-MCP/compare/v1.0.0...v1.0.1) (2025-08-27)


### Bug Fixes

* auto release ([d5f3561](https://github.com/muammar-yacoob/GMail-Manager-MCP/commit/d5f3561f93823f590844e5f8bc8e0bdf4fb9d8e5))

## [Unreleased] 🚀

### ✨ Added
- Initial Gmail MCP server implementation
- OAuth 2.0 authentication with Google APIs
- Email management tools for organizing inbox
- Search and filter capabilities
- Label management functionality

### 🔧 Changed
- Updated GitHub workflows to match project structure
- Configured semantic-release for automated versioning

### 🐛 Fixed
- Semantic release configuration for GitHub-only releases

### 📚 Documentation
- Added comprehensive README with setup instructions
- Created publishing guide for Smithery distribution

---

## Release Format

This changelog follows these conventions:
- 🚀 **Major** - Breaking changes
- ✨ **Minor** - New features  
- 🐛 **Patch** - Bug fixes
- 🔧 **Changed** - Improvements to existing features
- 📚 **Documentation** - Documentation updates
- 🗑️ **Removed** - Removed features
- 🔒 **Security** - Security improvements

---

*Generated automatically by [semantic-release](https://github.com/semantic-release/semantic-release)*
