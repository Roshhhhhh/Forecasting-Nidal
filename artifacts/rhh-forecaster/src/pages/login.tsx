import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      await loginMutation.mutateAsync({ data });
      setLocation("/dashboard");
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid email or password. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-6">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="h-14 w-14 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-3xl shadow-lg mb-4">
            R
          </div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">Royal Holiday Homes</h1>
          <p className="text-muted-foreground mt-2">Revenue Forecasting Platform</p>
        </div>

        <Card className="border-border/50 shadow-xl bg-card">
          <CardHeader>
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>Enter your credentials to access the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" id="login-form">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="name@royalholiday.ae" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              form="login-form" 
              className="w-full h-11 text-base font-medium transition-all"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Signing in..." : "Sign in to Dashboard"}
            </Button>
          </CardFooter>
        </Card>
        
        <div className="mt-8 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Royal Holiday Homes LLC. All rights reserved.
        </div>
      </div>
    </div>
  );
}
