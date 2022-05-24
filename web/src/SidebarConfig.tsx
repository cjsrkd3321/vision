// component
import Iconify from '@components/Iconify';

// ----------------------------------------------------------------------

const getIcon = (name: string) => (
  <Iconify icon={name} width={22} height={22} />
);

const sidebarConfig = [
  {
    title: 'QUERY',
    path: '/queries',
    icon: getIcon('carbon:query'),
    children: [
      {
        title: 'Editor',
        path: '/queries/editor',
      },
      {
        title: 'Compliance',
        path: '/queries/compliance',
      },
      {
        title: 'Custom',
        path: '/queries/custom',
      },
      {
        title: 'My Queries',
        path: '/queries/my-queries',
      },
    ],
  },
  {
    title: 'RESOURCE',
    path: '/resources',
    icon: getIcon('carbon:software-resource-cluster'),
    children: [
      {
        title: 'Resource',
        path: '/resources',
      },
    ],
  },
  {
    title: 'SECURITY GROUP',
    path: '/security-groups',
    icon: getIcon('clarity:firewall-line'),
    children: [
      {
        title: 'Request',
        path: '/security-groups/request',
      },
      // {
      //   title: 'My Rules',
      //   path: '/security-groups/my-rules',
      // },
      // {
      //   title: 'All Rules',
      //   path: '/security-groups/all-rules',
      // },
    ],
  },
  {
    title: 'COMPLIANCE',
    path: '/compliances',
    icon: getIcon('eva:pie-chart-2-fill'),
    children: [
      {
        title: 'Vulnerability',
        path: '/compliances/vulns',
      },
      {
        title: 'Exception',
        path: '/compliances/exceptions',
      },
      {
        title: 'Regular Inspection',
        path: '/compliances/regular-inspect',
      },
    ],
  },
  {
    title: 'USER',
    path: '/users',
    icon: getIcon('eva:people-fill'),
    children: [
      {
        title: 'Users',
        path: '/users',
      },
    ],
  },
];

export default sidebarConfig;
