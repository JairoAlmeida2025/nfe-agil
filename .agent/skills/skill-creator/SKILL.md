---
name: skill-creator
description: Creates new agent skills following the standard format. Use when the user wants to create a new skill, define agent capabilities, or extend the agent with reusable instructions.
---

# Skill Creator

This skill helps you create new agent skills that follow the standard format and best practices.

## When to Use This Skill

- User wants to create a new skill
- User wants to define reusable agent capabilities
- User wants to package instructions for specific tasks
- User mentions "create a skill", "new skill", "add a skill", or similar

## Skill Location Decision

Ask the user where they want the skill to live:

| Location | Scope | When to Use |
|----------|-------|-------------|
| `<workspace-root>/.agent/skills/<skill-folder>/` | Workspace-specific | Project-specific workflows, team conventions |
| `~/.gemini/antigravity/skills/<skill-folder>/` | Global (all workspaces) | Personal utilities, general-purpose tools |

**Default**: If the user doesn't specify, ask them to choose.

## Required Structure

Every skill needs this minimum structure:

```
<skill-folder>/
└─── SKILL.md       # Main instructions (required)
```

### Optional Additional Resources

For more complex skills, you may include:

```
<skill-folder>/
├─── SKILL.md       # Main instructions (required)
├─── scripts/       # Helper scripts (optional)
├─── examples/      # Reference implementations (optional)
└─── resources/     # Templates and other assets (optional)
```

## SKILL.md Template

Use this template when creating a new skill:

```markdown
---
name: <skill-name>
description: <Clear description of what the skill does and when to use it. Write in third person. Include keywords that help the agent recognize relevance.>
---

# <Skill Title>

Brief introduction explaining what this skill does.

## When to Use This Skill

- Use this when...
- This is helpful for...
- Triggers: keywords or phrases that indicate this skill is needed

## How to Use

Step-by-step guidance, conventions, and patterns the agent should follow.

### Step 1: [First Step]

Details...

### Step 2: [Second Step]

Details...

## Best Practices

- Key conventions to follow
- Common pitfalls to avoid
- Quality standards

## Examples

Include examples if helpful for understanding usage.
```

## Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | No | Unique identifier (lowercase, hyphens for spaces). Defaults to folder name if not provided. |
| `description` | **Yes** | Clear description of what the skill does and when to use it. This is what the agent sees when deciding whether to apply the skill. |

## Writing Effective Descriptions

The description is critical—it's how the agent decides whether to use the skill.

**Good descriptions:**
- Are specific about what the skill does
- Explain when it's useful
- Include relevant keywords
- Are written in third person

**Examples:**

✅ Good: `"Generates unit tests for Python code using pytest conventions. Use when creating tests, adding test coverage, or setting up a test suite."`

❌ Bad: `"Helps with testing"`

✅ Good: `"Reviews code changes for bugs, style issues, and best practices. Use when reviewing PRs, checking code quality, or preparing code for merge."`

❌ Bad: `"Code review skill"`

## Best Practices for Skill Creation

### 1. Keep Skills Focused

Each skill should do one thing well. Instead of a "do everything" skill, create separate skills for distinct tasks.

**Don't:**
- Create a "development" skill that handles testing, deployment, and code review

**Do:**
- Create separate skills: `unit-testing`, `deployment`, `code-review`

### 2. Use Scripts as Black Boxes

If your skill includes scripts, encourage the agent to run them with `--help` first rather than reading the entire source code? This keeps the agent's context focused on the task.

```markdown
## Using the Helper Script

Run `./scripts/generate.sh --help` to see available options before using.
```

### 3. Include Decision Trees for Complex Skills

Help the agent choose the right approach based on the situation:

```markdown
## Decision Tree

1. Is this a new project?
   - Yes → Follow "New Project Setup"
   - No → Continue to step 2

2. Does the project have existing tests?
   - Yes → Follow "Adding to Existing Tests"
   - No → Follow "Initial Test Setup"
```

### 4. Provide Clear Triggers

List specific keywords or phrases that indicate the skill is needed:

```markdown
## Triggers

This skill is relevant when the user mentions:
- "create tests", "add tests", "write tests"
- "test coverage", "unit tests", "integration tests"
- "pytest", "testing framework"
```

## Creation Workflow

When creating a new skill:

1. **Gather Requirements**
   - What task does the skill address?
   - What are the key steps or conventions?
   - Are there scripts or resources needed?

2. **Choose Location**
   - Workspace-specific or global?
   - Confirm with user if not specified

3. **Create the Skill Folder**
   - Use lowercase with hyphens for the folder name
   - Create SKILL.md with proper frontmatter

4. **Write Clear Instructions**
   - Focus on actionable guidance
   - Include examples where helpful
   - Add decision trees for complex workflows

5. **Add Optional Resources**
   - Scripts in `scripts/` folder
   - Examples in `examples/` folder
   - Templates in `resources/` folder

6. **Verify**
   - Check frontmatter is valid YAML
   - Ensure description is clear and specific
   - Confirm all referenced files exist

## Example: Creating a Simple Skill

User: "Create a skill for writing commit messages"

```markdown
---
name: commit-message
description: Writes clear, conventional commit messages following best practices. Use when committing code, writing PR descriptions, or standardizing commit history.
---

# Commit Message Skill

Helps write clear, conventional commit messages.

## When to Use

- Writing commit messages
- Reviewing commit history
- Standardizing team conventions

## Format

Follow the Conventional Commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

## Examples

✅ `feat(auth): add password reset functionality`
✅ `fix(api): handle null response from external service`
✅ `docs(readme): update installation instructions`
```
