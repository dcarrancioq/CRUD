import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, throwError, of, delay } from 'rxjs';
import { 
  User, 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse, 
  PasswordResetRequest,
  PasswordChangeRequest,
  UpdateProfileRequest
} from '../models/user.model';
import { environment } from '../../../environments/environment';

interface MockUser {
  email: string;
  password: string;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/auth`;
  private readonly USE_MOCK = true;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);

  private mockUsers: MockUser[] = [
    {
      email: 'admin@tienda.com',
      password: 'Admin123!',
      user: {
        id: '1',
        email: 'admin@tienda.com',
        firstName: 'Admin',
        lastName: 'Usuario',
        role: 'admin',
        phone: '+34 600 000 001',
        avatar: '',
        addresses: [],
        preferences: { newsletter: false, marketingEmails: false, orderNotifications: true, language: 'es', currency: 'EUR' },
        isEmailVerified: true,
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      }
    },
    {
      email: 'usuario@tienda.com',
      password: 'Usuario123!',
      user: {
        id: '2',
        email: 'usuario@tienda.com',
        firstName: 'Juan',
        lastName: 'Garcia',
        role: 'customer',
        phone: '+34 600 000 002',
        avatar: '',
        addresses: [],
        preferences: { newsletter: true, marketingEmails: true, orderNotifications: true, language: 'es', currency: 'EUR' },
        isEmailVerified: true,
        isActive: true,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15')
      }
    },
    {
      email: 'test@test.com',
      password: 'Test1234!',
      user: {
        id: '3',
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'customer',
        phone: '+34 600 000 003',
        avatar: '',
        addresses: [],
        preferences: { newsletter: false, marketingEmails: false, orderNotifications: true, language: 'es', currency: 'EUR' },
        isEmailVerified: true,
        isActive: true,
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-01')
      }
    }
  ];

  currentUser$ = this.currentUserSubject.asObservable();
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadStoredUser();
  }

  private loadStoredUser(): void {
    const storedUser = localStorage.getItem('currentUser');
    const token = localStorage.getItem('accessToken');
    if (storedUser && token) {
      this.currentUserSubject.next(JSON.parse(storedUser));
      this.isAuthenticatedSubject.next(true);
    }
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    if (this.USE_MOCK) {
      return this.mockLogin(credentials);
    }
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials).pipe(
      tap(response => this.handleAuthResponse(response, credentials.rememberMe)),
      catchError(error => this.handleError(error))
    );
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    if (this.USE_MOCK) {
      return this.mockRegister(data);
    }
    return this.http.post<AuthResponse>(`${this.API_URL}/register`, data).pipe(
      tap(response => this.handleAuthResponse(response, true)),
      catchError(error => this.handleError(error))
    );
  }

  private mockLogin(credentials: LoginRequest): Observable<AuthResponse> {
    const mockUser = this.mockUsers.find(
      u => u.email.toLowerCase() === credentials.email.toLowerCase() && u.password === credentials.password
    );

    if (mockUser) {
      const response: AuthResponse = {
        user: mockUser.user,
        accessToken: 'mock-access-token-' + Date.now(),
        refreshToken: 'mock-refresh-token-' + Date.now(),
        expiresIn: 3600
      };
      return of(response).pipe(
        delay(500),
        tap(res => this.handleAuthResponse(res, credentials.rememberMe))
      );
    }

    return throwError(() => new Error('Credenciales invalidas. Usuarios de prueba: admin@tienda.com / Admin123! o usuario@tienda.com / Usuario123!'));
  }

  private mockRegister(data: RegisterRequest): Observable<AuthResponse> {
    const existingUser = this.mockUsers.find(
      u => u.email.toLowerCase() === data.email.toLowerCase()
    );

    if (existingUser) {
      return throwError(() => new Error('El email ya esta registrado'));
    }

    const newUser: User = {
      id: String(this.mockUsers.length + 1),
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: 'customer',
      phone: data.phone || '',
      avatar: '',
      addresses: [],
      preferences: { newsletter: data.subscribeNewsletter || false, marketingEmails: false, orderNotifications: true, language: 'es', currency: 'EUR' },
      isEmailVerified: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.mockUsers.push({
      email: data.email,
      password: data.password,
      user: newUser
    });

    const response: AuthResponse = {
      user: newUser,
      accessToken: 'mock-access-token-' + Date.now(),
      refreshToken: 'mock-refresh-token-' + Date.now(),
      expiresIn: 3600
    };

    return of(response).pipe(
      delay(500),
      tap(res => this.handleAuthResponse(res, true))
    );
  }

  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  refreshToken(): Observable<AuthResponse> {
    const refreshToken = localStorage.getItem('refreshToken');
    return this.http.post<AuthResponse>(`${this.API_URL}/refresh`, { refreshToken }).pipe(
      tap(response => this.handleAuthResponse(response, true)),
      catchError(error => {
        this.logout();
        return throwError(() => error);
      })
    );
  }

  requestPasswordReset(data: PasswordResetRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/password-reset`, data);
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.requestPasswordReset({ email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/password-reset/confirm`, {
      token,
      newPassword
    });
  }

  changePassword(data: PasswordChangeRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/change-password`, data);
  }

  updateProfile(data: UpdateProfileRequest): Observable<User> {
    return this.http.put<User>(`${this.API_URL}/profile`, data).pipe(
      tap(user => {
        this.currentUserSubject.next(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
      })
    );
  }

  verifyEmail(token: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/verify-email`, { token });
  }

  resendVerificationEmail(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/resend-verification`, {});
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  get accessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  private handleAuthResponse(response: AuthResponse, remember?: boolean): void {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('accessToken', response.accessToken);
    storage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem('currentUser', JSON.stringify(response.user));
    this.currentUserSubject.next(response.user);
    this.isAuthenticatedSubject.next(true);
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'An error occurred';
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.status === 401) {
      errorMessage = 'Invalid credentials';
    } else if (error.status === 409) {
      errorMessage = 'Email already exists';
    }
    return throwError(() => new Error(errorMessage));
  }
}
