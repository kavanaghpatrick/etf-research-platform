import type { Preview } from '@storybook/react';
import '../src/app/globals.css';

/**
 * Storybook preview configuration
 * Sets up global decorators, parameters, and controls
 */
const preview: Preview = {
  parameters: {
    // Actions addon configuration
    actions: { argTypesRegex: '^on[A-Z].*' },
    
    // Controls addon configuration
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
      expanded: true,
      sort: 'requiredFirst',
    },
    
    // Docs addon configuration
    docs: {
      toc: {
        contentsSelector: '.sbdocs-content',
        headingSelector: 'h1, h2, h3',
        ignoreSelector: '#primary',
        title: 'Table of Contents',
        disable: false,
        unsafeTocbotOptions: {
          orderedList: false,
        },
      },
    },
    
    // Viewport addon configuration
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: {
            width: '375px',
            height: '667px',
          },
        },
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1024px',
            height: '768px',
          },
        },
        largeDesktop: {
          name: 'Large Desktop',
          styles: {
            width: '1440px',
            height: '900px',
          },
        },
      },
    },
    
    // Accessibility addon configuration
    a11y: {
      element: '#storybook-root',
      config: {
        rules: [
          {
            id: 'autocomplete-valid',
            enabled: true,
          },
          {
            id: 'button-name',
            enabled: true,
          },
          {
            id: 'color-contrast',
            enabled: true,
          },
          {
            id: 'focus-order-semantics',
            enabled: true,
          },
          {
            id: 'form-field-multiple-labels',
            enabled: true,
          },
          {
            id: 'frame-title',
            enabled: true,
          },
          {
            id: 'image-alt',
            enabled: true,
          },
          {
            id: 'input-image-alt',
            enabled: true,
          },
          {
            id: 'label',
            enabled: true,
          },
          {
            id: 'link-name',
            enabled: true,
          },
        ],
      },
      options: {},
      manual: true,
    },
    
    // Background addon configuration
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#ffffff',
        },
        {
          name: 'dark',
          value: '#333333',
        },
        {
          name: 'gray',
          value: '#f5f5f5',
        },
      ],
    },
    
    // Layout configuration
    layout: 'centered',
    
    // Options configuration
    options: {
      storySort: {
        order: [
          'Introduction',
          'Design System',
          ['Colors', 'Typography', 'Spacing', 'Components'],
          'Components',
          ['Basic', 'Forms', 'Navigation', 'Data Display', 'Feedback', 'Layout'],
          'Pages',
          'Documentation',
        ],
      },
    },
  },
  
  // Global arg types
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes',
      table: {
        category: 'Styling',
        type: { summary: 'string' },
      },
    },
    children: {
      control: false,
      description: 'React children elements',
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
  },
  
  // Global args
  args: {},
  
  // Tags
  tags: ['autodocs'],
};

export default preview;