import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, throwError } from 'rxjs';
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

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);

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
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials).pipe(
      tap(response => this.handleAuthResponse(response, credentials.rememberMe)),
      catchError(error => this.handleError(error))
    );
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/register`, data).pipe(
      tap(response => this.handleAuthResponse(response, true)),
      catchError(error => this.handleError(error))
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
