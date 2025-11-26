import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useInitializeAdmin = () => {
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAdmin = async () => {
      try {
        // Check if admin is already initialized
        const { data: config } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'admin_created')
          .maybeSingle();

        if (!config || config.value !== 'true') {
          // Call edge function to initialize admin
          const { error } = await supabase.functions.invoke('initialize-admin');
          if (error) {
            console.error('Error initializing admin:', error);
          }
        }
        
        setInitialized(true);
      } catch (error) {
        console.error('Error checking admin status:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAdmin();
  }, []);

  return { initialized, loading };
};
