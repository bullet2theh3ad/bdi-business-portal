import { z } from 'zod';
import { User } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';

export type ActionState = {
  error?: string;
  success?: string;
  [key: string]: any; // This allows for additional properties
};

type ValidatedActionFunction<S extends z.ZodType<any, any>, T> = (
  data: z.infer<S>,
  formData: FormData
) => Promise<T>;

export function validatedAction<S extends z.ZodType<any, any>, T>(
  schema: S,
  action: ValidatedActionFunction<S, T>
) {
  return async (prevState: ActionState, formData: FormData) => {
    const formDataObject = Object.fromEntries(formData);
    
    const result = schema.safeParse(formDataObject);
    if (!result.success) {
      return { error: `Validation failed: ${result.error.errors[0].message}` };
    }

    return action(result.data, formData);
  };
}

type ValidatedActionWithUserFunction<S extends z.ZodType<any, any>, T> = (
  data: z.infer<S>,
  formData: FormData,
  user: User
) => Promise<T>;

export function validatedActionWithUser<S extends z.ZodType<any, any>, T>(
  schema: S,
  action: ValidatedActionWithUserFunction<S, T>
) {
  return async (prevState: ActionState, formData: FormData) => {
    try {
      const user = await getUser();
      if (!user) {
        throw new Error('User is not authenticated');
      }

      const formDataObject = Object.fromEntries(formData);
      
      const result = schema.safeParse(formDataObject);
      if (!result.success) {
        return { error: `Validation failed: ${result.error.errors[0].message}` };
      }

      const actionResult = await action(result.data, formData, user);
      return actionResult;
    } catch (error) {
      console.error('Server action error:', error);
      return { error: `Server error: ${error}` };
    }
  };
}

type ActionWithTeamFunction<T> = (
  formData: FormData,
  team: any
) => Promise<T>;

// Legacy withTeam function removed - not needed for B2B portal
