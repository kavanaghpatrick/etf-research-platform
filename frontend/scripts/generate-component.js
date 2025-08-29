#!/usr/bin/env node

/**
 * @fileoverview Component generation script with templates
 * @description Automates the creation of React components with TypeScript, tests, and stories
 * @author Claude Code Quality Agent F
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Component templates and configurations
 */
const TEMPLATES = {
  component: {
    name: 'React Component',
    description: 'Standard React functional component with TypeScript',
    files: ['component.tsx', 'index.ts', 'component.test.tsx', 'component.stories.tsx'],
  },
  hook: {
    name: 'Custom Hook',
    description: 'Custom React hook with TypeScript',
    files: ['hook.ts', 'index.ts', 'hook.test.ts'],
  },
  page: {
    name: 'Next.js Page',
    description: 'Next.js page component with SEO and accessibility',
    files: ['page.tsx', 'page.test.tsx'],
  },
  util: {
    name: 'Utility Function',
    description: 'Utility function with TypeScript and tests',
    files: ['util.ts', 'index.ts', 'util.test.ts'],
  },
};

/**
 * File content templates
 */
const FILE_TEMPLATES = {
  'component.tsx': (name, props) => `/**
 * @fileoverview ${name} component
 * @description ${props.description || `${name} component description`}
 * @author ${props.author || 'Developer'}
 * @version 1.0.0
 */

'use client';

import { memo } from 'react';

interface ${name}Props {
  /** Component children */
  readonly children?: React.ReactNode;
  /** Additional CSS classes */
  readonly className?: string;
  /** Component test identifier */
  readonly 'data-testid'?: string;
}

/**
 * ${name} component
 * 
 * @param props - Component props
 * @param props.children - Child elements to render
 * @param props.className - Additional CSS classes to apply
 * @param props.data-testid - Test identifier for testing
 * @returns JSX element representing the ${name} component
 * 
 * @example
 * \`\`\`tsx
 * <${name} className="custom-class">
 *   Content goes here
 * </${name}>
 * \`\`\`
 */
export const ${name} = memo<${name}Props>(function ${name}({
  children,
  className = '',
  'data-testid': testId = '${name.toLowerCase()}',
}) {
  return (
    <div 
      className={\`${name.toLowerCase()} \${className}\`.trim()}
      data-testid={testId}
    >
      {children}
    </div>
  );
});

${name}.displayName = '${name}';`,

  'index.ts': (name, props) => `/**
 * @fileoverview ${name} module exports
 * @description Main export file for ${name} ${props.type || 'component'}
 */

export { ${name} } from './${name}';${props.type === 'component' ? `
export type { ${name}Props } from './${name}';` : ''}`,

  'component.test.tsx': (name, props) => `/**
 * @fileoverview Tests for ${name} component
 * @description Comprehensive test suite for ${name} component
 */

import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ${name} } from './${name}';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('${name}', () => {
  it('renders without crashing', () => {
    render(<${name} />);
    expect(screen.getByTestId('${name.toLowerCase()}')).toBeInTheDocument();
  });

  it('renders children correctly', () => {
    const testContent = 'Test content';
    render(<${name}>{testContent}</${name}>);
    expect(screen.getByText(testContent)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const customClass = 'custom-test-class';
    render(<${name} className={customClass} />);
    expect(screen.getByTestId('${name.toLowerCase()}')).toHaveClass(customClass);
  });

  it('uses custom test id', () => {
    const customTestId = 'custom-test-id';
    render(<${name} data-testid={customTestId} />);
    expect(screen.getByTestId(customTestId)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<${name}>Accessible content</${name}>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('handles empty children gracefully', () => {
    render(<${name} />);
    const element = screen.getByTestId('${name.toLowerCase()}');
    expect(element).toBeInTheDocument();
    expect(element).toBeEmptyDOMElement();
  });
});`,

  'component.stories.tsx': (name, props) => `/**
 * @fileoverview Storybook stories for ${name} component
 * @description Interactive documentation and testing for ${name}
 */

import type { Meta, StoryObj } from '@storybook/react';
import { ${name} } from './${name}';

const meta: Meta<typeof ${name}> = {
  title: 'Components/${props.category || 'General'}/${name}',
  component: ${name},
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: \`
${props.description || `The ${name} component provides...`}

## Features
- Feature 1
- Feature 2
- Feature 3

## Accessibility
- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader friendly
        \`,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    children: {
      control: 'text',
      description: 'Content to display inside the component',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state of the component
 */
export const Default: Story = {
  args: {
    children: 'Default ${name} content',
  },
};

/**
 * Component with custom styling
 */
export const CustomStyling: Story = {
  args: {
    children: 'Styled ${name} content',
    className: 'p-4 bg-blue-50 border border-blue-200 rounded-lg',
  },
};

/**
 * Component with no content
 */
export const Empty: Story = {
  args: {},
};

/**
 * Component with rich content
 */
export const RichContent: Story = {
  args: {
    children: (
      <div>
        <h3>Rich Content Example</h3>
        <p>This demonstrates how the ${name} component handles complex nested content.</p>
        <button type="button">Interactive Element</button>
      </div>
    ),
  },
};`,

  'hook.ts': (name, props) => `/**
 * @fileoverview ${name} custom hook
 * @description ${props.description || `Custom React hook: ${name}`}
 * @author ${props.author || 'Developer'}
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Configuration options for ${name}
 */
export interface ${name}Options {
  /** Option 1 description */
  readonly option1?: boolean;
  /** Option 2 description */
  readonly option2?: string;
}

/**
 * Return type for ${name}
 */
export interface ${name}Return {
  /** Current state value */
  readonly value: unknown;
  /** Loading state */
  readonly loading: boolean;
  /** Error state */
  readonly error: Error | null;
  /** Function to update the value */
  readonly updateValue: (newValue: unknown) => void;
  /** Function to reset the hook state */
  readonly reset: () => void;
}

/**
 * ${name} custom hook
 * 
 * @param options - Hook configuration options
 * @returns Hook state and methods
 * 
 * @example
 * \`\`\`tsx
 * const { value, loading, error, updateValue, reset } = ${name}({
 *   option1: true,
 *   option2: 'example',
 * });
 * \`\`\`
 */
export const ${name} = (options: ${name}Options = {}): ${name}Return => {
  const [value, setValue] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateValue = useCallback((newValue: unknown) => {
    try {
      setError(null);
      setValue(newValue);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
    }
  }, []);

  const reset = useCallback(() => {
    setValue(null);
    setLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    // Hook effect logic here
    if (options.option1) {
      setLoading(true);
      // Simulate async operation
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    }
  }, [options.option1]);

  return {
    value,
    loading,
    error,
    updateValue,
    reset,
  };
};`,

  'hook.test.ts': (name, props) => `/**
 * @fileoverview Tests for ${name} hook
 * @description Comprehensive test suite for ${name} custom hook
 */

import { renderHook, act } from '@testing-library/react';
import { ${name} } from './${name}';

describe('${name}', () => {
  it('initializes with default values', () => {
    const { result } = renderHook(() => ${name}());
    
    expect(result.current.value).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.updateValue).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });

  it('updates value correctly', () => {
    const { result } = renderHook(() => ${name}());
    const testValue = 'test value';
    
    act(() => {
      result.current.updateValue(testValue);
    });
    
    expect(result.current.value).toBe(testValue);
    expect(result.current.error).toBeNull();
  });

  it('resets state correctly', () => {
    const { result } = renderHook(() => ${name}());
    
    // First set a value
    act(() => {
      result.current.updateValue('test');
    });
    
    // Then reset
    act(() => {
      result.current.reset();
    });
    
    expect(result.current.value).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('handles options correctly', () => {
    const options = { option1: true, option2: 'test' };
    const { result } = renderHook(() => ${name}(options));
    
    // Initial loading state when option1 is true
    expect(result.current.loading).toBe(true);
  });

  it('handles errors gracefully', () => {
    const { result } = renderHook(() => ${name}());
    
    act(() => {
      // This would normally cause an error in real implementation
      result.current.updateValue(undefined);
    });
    
    // Error handling would be implemented based on specific requirements
    expect(result.current.error).toBeNull(); // Adjust based on actual error handling
  });
});`,

  'page.tsx': (name, props) => `/**
 * @fileoverview ${name} page component
 * @description Next.js page component with SEO and accessibility features
 * @author ${props.author || 'Developer'}
 * @version 1.0.0
 */

import { Metadata } from 'next';
import { PageErrorBoundary } from '@/components/errors/ErrorBoundaryHierarchy';

/**
 * Metadata for the ${name} page
 */
export const metadata: Metadata = {
  title: '${name} | ETF Research Platform',
  description: '${props.description || `${name} page description`}',
  keywords: ['${name.toLowerCase()}', 'etf', 'research', 'platform'],
  openGraph: {
    title: '${name} | ETF Research Platform',
    description: '${props.description || `${name} page description`}',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '${name} | ETF Research Platform',
    description: '${props.description || `${name} page description`}',
  },
};

/**
 * ${name} page component
 * 
 * @returns JSX element representing the ${name} page
 */
export default function ${name}Page() {
  return (
    <PageErrorBoundary pageName="${name}">
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              ${name}
            </h1>
            <p className="text-lg text-gray-600">
              ${props.description || `Welcome to the ${name} page`}
            </p>
          </header>
          
          <section className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Content Section
            </h2>
            <p className="text-gray-600">
              Page content goes here...
            </p>
          </section>
        </div>
      </main>
    </PageErrorBoundary>
  );
}`,

  'page.test.tsx': (name, props) => `/**
 * @fileoverview Tests for ${name} page
 * @description Test suite for ${name} page component
 */

import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import ${name}Page from './${name}Page';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('${name}Page', () => {
  it('renders the page correctly', () => {
    render(<${name}Page />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('${name}');
  });

  it('has proper heading hierarchy', () => {
    render(<${name}Page />);
    const h1 = screen.getByRole('heading', { level: 1 });
    const h2 = screen.getByRole('heading', { level: 2 });
    
    expect(h1).toBeInTheDocument();
    expect(h2).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<${name}Page />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('contains expected content sections', () => {
    render(<${name}Page />);
    expect(screen.getByText('Content Section')).toBeInTheDocument();
  });
});`,

  'util.ts': (name, props) => `/**
 * @fileoverview ${name} utility function
 * @description ${props.description || `Utility function: ${name}`}
 * @author ${props.author || 'Developer'}
 * @version 1.0.0
 */

/**
 * Configuration options for ${name}
 */
export interface ${name}Options {
  /** Option 1 description */
  readonly option1?: boolean;
  /** Option 2 description */
  readonly option2?: string;
}

/**
 * ${name} utility function
 * 
 * @param input - Input parameter description
 * @param options - Optional configuration
 * @returns Processed result
 * 
 * @example
 * \`\`\`typescript
 * const result = ${name}('input value', { option1: true });
 * console.log(result);
 * \`\`\`
 */
export const ${name} = (
  input: string,
  options: ${name}Options = {}
): string => {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input: expected non-empty string');
  }

  const { option1 = false, option2 = '' } = options;

  let result = input.trim();

  if (option1) {
    result = result.toLowerCase();
  }

  if (option2) {
    result = \`\${option2}: \${result}\`;
  }

  return result;
};

/**
 * Helper function for ${name}
 * 
 * @param value - Value to process
 * @returns Processed value
 */
export const ${name}Helper = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
};`,

  'util.test.ts': (name, props) => `/**
 * @fileoverview Tests for ${name} utility
 * @description Comprehensive test suite for ${name} utility function
 */

import { ${name}, ${name}Helper } from './${name}';

describe('${name}', () => {
  it('processes input correctly with default options', () => {
    const input = '  Test Input  ';
    const result = ${name}(input);
    expect(result).toBe('Test Input');
  });

  it('applies option1 correctly', () => {
    const input = 'TEST INPUT';
    const result = ${name}(input, { option1: true });
    expect(result).toBe('test input');
  });

  it('applies option2 correctly', () => {
    const input = 'input';
    const result = ${name}(input, { option2: 'prefix' });
    expect(result).toBe('prefix: input');
  });

  it('applies both options correctly', () => {
    const input = 'TEST INPUT';
    const result = ${name}(input, { option1: true, option2: 'prefix' });
    expect(result).toBe('prefix: test input');
  });

  it('throws error for invalid input', () => {
    expect(() => ${name}('')).toThrow('Invalid input: expected non-empty string');
    expect(() => ${name}(null as any)).toThrow('Invalid input: expected non-empty string');
    expect(() => ${name}(123 as any)).toThrow('Invalid input: expected non-empty string');
  });

  it('handles edge cases', () => {
    expect(${name}(' ')).toBe('');
    expect(${name}('a')).toBe('a');
  });
});

describe('${name}Helper', () => {
  it('converts values to strings correctly', () => {
    expect(${name}Helper('test')).toBe('test');
    expect(${name}Helper(123)).toBe('123');
    expect(${name}Helper(true)).toBe('true');
    expect(${name}Helper(null)).toBe('');
    expect(${name}Helper(undefined)).toBe('');
  });

  it('handles complex objects', () => {
    expect(${name}Helper({ key: 'value' })).toBe('[object Object]');
    expect(${name}Helper([1, 2, 3])).toBe('1,2,3');
  });
});`,
};

/**
 * Prompts user for input
 */
function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Creates directory if it doesn't exist
 */
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(\`📁 Created directory: \${dirPath}\`);
  }
}

/**
 * Writes file with content
 */
function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content);
  console.log(\`📄 Created file: \${filePath}\`);
}

/**
 * Converts kebab-case or camelCase to PascalCase
 */
function toPascalCase(str) {
  return str
    .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
    .replace(/^(.)/, (_, char) => char.toUpperCase());
}

/**
 * Generates component files
 */
async function generateComponent() {
  console.log('🚀 Component Generator');
  console.log('=====================');

  // Show available templates
  console.log('\\nAvailable templates:');
  Object.entries(TEMPLATES).forEach(([key, template]) => {
    console.log(\`  \${key}: \${template.name} - \${template.description}\`);
  });

  // Get template type
  const templateType = await promptUser('\\nSelect template type: ');
  if (!TEMPLATES[templateType]) {
    console.error(\`❌ Invalid template type: \${templateType}\`);
    process.exit(1);
  }

  const template = TEMPLATES[templateType];

  // Get component details
  const rawName = await promptUser('Enter component name (e.g., my-component, MyComponent): ');
  const name = toPascalCase(rawName);
  
  const description = await promptUser('Enter component description (optional): ');
  const author = await promptUser('Enter author name (optional): ');
  const category = templateType === 'component' ? await promptUser('Enter component category (optional): ') : undefined;

  // Determine output directory
  let outputDir;
  if (templateType === 'component') {
    outputDir = path.join('src', 'components', rawName.toLowerCase());
  } else if (templateType === 'hook') {
    outputDir = path.join('src', 'hooks');
  } else if (templateType === 'page') {
    outputDir = path.join('src', 'app', rawName.toLowerCase());
  } else if (templateType === 'util') {
    outputDir = path.join('src', 'utils');
  }

  // Create output directory
  ensureDirectory(outputDir);

  // Generate files
  const props = {
    name,
    description,
    author,
    category,
    type: templateType,
  };

  template.files.forEach(fileTemplate => {
    const templateKey = fileTemplate;
    const fileName = fileTemplate.replace('component', name).replace('hook', \`use\${name}\`).replace('util', \`\${name.toLowerCase()}Utils\`).replace('page', \`\${name}Page\`);
    const filePath = path.join(outputDir, fileName);
    
    if (FILE_TEMPLATES[templateKey]) {
      const content = FILE_TEMPLATES[templateKey](templateType === 'hook' ? \`use\${name}\` : name, props);
      writeFile(filePath, content);
    }
  });

  console.log(\`\\n✅ Successfully generated \${template.name}: \${name}\`);
  console.log(\`📍 Location: \${outputDir}\`);
  console.log(\`\\nGenerated files:\`);
  template.files.forEach(file => {
    const fileName = file.replace('component', name).replace('hook', \`use\${name}\`).replace('util', \`\${name.toLowerCase()}Utils\`).replace('page', \`\${name}Page\`);
    console.log(\`  - \${fileName}\`);
  });
}

/**
 * Main execution
 */
async function main() {
  try {
    await generateComponent();
  } catch (error) {
    console.error(\`❌ Error generating component: \${error.message}\`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateComponent,
  TEMPLATES,
  FILE_TEMPLATES,
};