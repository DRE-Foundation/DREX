import colors from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';


function TabBarIcon({
  color,
  focused,
  outlineName,
  filledName,
}: {
  color: string;
  focused: boolean;
  outlineName: ComponentProps<typeof Ionicons>['name'];
  filledName: ComponentProps<typeof Ionicons>['name'];
}) {
  return <Ionicons color={color} name={focused ? filledName : outlineName} size={22} />;
}

export default function PanelLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: '#7f8499',
        tabBarStyle: {
          backgroundColor: '#121526',
          borderTopColor: '#1f2337',
          height: 78,
          paddingTop: 8,
          paddingBottom: 14,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        sceneStyle: {
          backgroundColor: colors.zinc,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard/page"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              outlineName="grid-outline"
              filledName="grid"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="transactions/page"
        options={{
          title: 'Transacoes',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              outlineName="swap-horizontal-outline"
              filledName="swap-horizontal"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="ai/page"
        options={{
          title: 'IA',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              outlineName="sparkles-outline"
              filledName="sparkles"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile/page"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              outlineName="person-outline"
              filledName="person"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="settings/page"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              outlineName="settings-outline"
              filledName="settings"
            />
          ),
        }}
      />

            <Tabs.Screen
        name="transactions/edit"
        options={{
          href: null,
        }}
      />


      <Tabs.Screen
        name="transactions/new"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
