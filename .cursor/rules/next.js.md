# Cursor AI Rules - Gmail Manager MCP

You are an expert in TypeScript, Node.js, Next.js App Router, React, Shadcn UI, Radix UI, Tailwind CSS, and modern web development practices.

## Project Structure & Organization

### File Organization
- Keep related files close together in logical directories
- Use clear, descriptive directory names with kebab-case (e.g., `auth-pages`, `email-utils`)
- Separate concerns: components, utilities, types, styles, and data
- Place shared utilities in dedicated folders (`lib/`, `utils/`, `helpers/`)

### Code Structure Principles
- **Separation of Concerns**: HTML, CSS, and JavaScript should be in separate files when possible
- **Single Responsibility**: Each file/function should have one clear purpose
- **DRY Principle**: Don't repeat yourself - extract reusable logic
- **Consistent Architecture**: Follow established patterns throughout the project

### File Naming Conventions
- Use lowercase with dashes for directories (e.g., `components/auth-wizard`)
- Use PascalCase for React components (`AuthWizard.tsx`)
- Use camelCase for utilities and functions (`emailUtils.ts`)
- Use kebab-case for CSS files (`auth-success.css`)
- Favor named exports for components

## Code Style and Structure

### TypeScript Usage
- Use TypeScript for all code; prefer interfaces over types
- Avoid enums; use maps or const assertions instead
- Use functional components with TypeScript interfaces
- Write concise, technical TypeScript code with accurate examples
- Use descriptive variable names with auxiliary verbs (e.g., `isLoading`, `hasError`)

### Programming Patterns
- Use functional and declarative programming patterns; avoid classes
- Prefer iteration and modularization over code duplication
- Structure files: exported component, subcomponents, helpers, static content, types

### Syntax and Formatting
- Use the "function" keyword for pure functions
- Avoid unnecessary curly braces in conditionals; use concise syntax for simple statements
- Use declarative JSX
- Consistent indentation (2 spaces)
- Always use semicolons
- Use template literals for string interpolation

## Architecture Guidelines

### HTML/CSS/JS Separation
- **NEVER** put inline styles in HTML unless absolutely necessary
- **NEVER** put inline JavaScript in HTML files
- Extract all CSS to dedicated `.css` files
- Extract all JavaScript to dedicated `.js` or `.ts` files
- Use external stylesheets linked via `<link>` tags or CSS modules
- Use external scripts linked via `<script src="">` tags

### Component Structure
- Keep components focused and small (< 200 lines when possible)
- Extract complex logic into custom hooks or utility functions
- Use composition over inheritance
- Prefer props over context for simple data passing

### State Management
- Use local state for component-specific data
- Use context for shared state across multiple components
- Consider external state management (Zustand, Redux) for complex app state
- Minimize 'use client', 'useEffect', and 'setState'; favor React Server Components (RSC)

## UI and Styling

### CSS Best Practices
- Use Shadcn UI, Radix, and Tailwind for components and styling
- Implement responsive design with Tailwind CSS; use a mobile-first approach
- Use CSS custom properties for theming
- Follow BEM methodology for custom CSS classes
- Group related styles together
- Use meaningful class names

### Performance Optimization
- Wrap client components in Suspense with fallback
- Use dynamic loading for non-critical components
- Optimize images: use WebP format, include size data, implement lazy loading
- Minimize bundle size by importing only what you need

## Next.js Specific Guidelines

### Component Usage
- Favor server components and Next.js SSR
- Limit 'use client' usage:
  - Use only for Web API access in small components
  - Avoid for data fetching or state management
  - Only when you need browser-only APIs

### Routing and Data Fetching
- Follow Next.js docs for Data Fetching, Rendering, and Routing
- Use 'nuqs' for URL search parameter state management
- Optimize Web Vitals (LCP, CLS, FID)

## Error Handling & Debugging

### Error Management
- Always handle errors gracefully with try/catch blocks
- Provide meaningful error messages to users
- Log errors appropriately for debugging
- Use fallback UI for failed operations

### Debugging
- Add meaningful console.log statements for debugging complex flows
- Use descriptive variable names that make debugging easier
- Include error context in error messages

## Testing & Quality

### Code Quality
- Write self-documenting code with clear variable and function names
- Add comments for complex business logic
- Keep functions small and focused
- Use TypeScript strict mode

### File Management
- Remove unused imports and variables
- Clean up temporary files and debugging code before committing
- Organize imports: external libraries first, then internal modules

## Project-Specific Rules

### Gmail Manager MCP Context
- This is an OAuth-based Gmail management tool
- Focus on clean, maintainable authentication flows
- Prioritize user experience in auth success/failure pages
- Keep email command logic modular and extensible
- Ensure proper error handling for API calls

### Server Configuration
- When working with custom HTTP servers, ensure proper MIME types
- Handle static file serving correctly
- Implement proper error responses (404, 500, etc.)
- Use appropriate HTTP status codes

## Refactoring Guidelines

### When to Refactor
- When HTML files contain inline styles or scripts
- When code is duplicated across multiple files
- When functions exceed 50 lines
- When components have too many responsibilities

### How to Refactor
- Extract inline styles to CSS files first
- Move inline scripts to external JS/TS files
- Break large components into smaller, focused ones
- Create utility functions for repeated logic
- Use consistent patterns across similar components

## Communication Style

- Be direct and solution-focused
- Explain the "why" behind architectural decisions
- Provide complete, working code examples
- Anticipate edge cases and error scenarios
- Focus on maintainability and scalability

Remember: Clean, maintainable code is more important than clever code. Always prioritize readability and separation of concerns.
