//
//  LoginView.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import SwiftUI

struct LoginView: View {
    // MARK: - State

    @StateObject private var viewModel: AuthViewModel
    @State private var isRegisterViewPresented = false

    // MARK: - Initialization

    init(viewModel: AuthViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    // MARK: - Body

    var body: some View {
        NavigationView {
            ZStack {
                // Background gradient
                LinearGradient(
                    colors: [Color.blue.opacity(0.6), Color.purple.opacity(0.6)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                VStack(spacing: 24) {
                    // Logo/Title
                    VStack(spacing: 8) {
                        Image(systemName: "waveform.circle.fill")
                            .font(.system(size: 80))
                            .foregroundStyle(.white)

                        Text("Glide")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .foregroundStyle(.white)

                        Text("Voice memos that work for you")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.9))
                    }
                    .padding(.bottom, 40)

                    // Form
                    VStack(spacing: 16) {
                        // Email TextField
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Email")
                                .font(.headline)
                                .foregroundStyle(.white)

                            TextField("Enter your email", text: $viewModel.email)
                                .textFieldStyle(.plain)
                                .padding()
                                .background(Color.white.opacity(0.2))
                                .cornerRadius(12)
                                .foregroundStyle(.white)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                        }

                        // Password SecureField
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Password")
                                .font(.headline)
                                .foregroundStyle(.white)

                            SecureField("Enter your password", text: $viewModel.password)
                                .textFieldStyle(.plain)
                                .padding()
                                .background(Color.white.opacity(0.2))
                                .cornerRadius(12)
                                .foregroundStyle(.white)
                        }

                        // Error Message
                        if let errorMessage = viewModel.errorMessage {
                            Text(errorMessage)
                                .font(.caption)
                                .foregroundStyle(.white)
                                .padding(.vertical, 4)
                        }

                        // Login Button
                        Button(action: {
                            Task {
                                await viewModel.login()
                            }
                        }) {
                            if viewModel.isLoading {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color.white.opacity(0.3))
                                    .cornerRadius(12)
                            } else {
                                Text("Login")
                                    .font(.headline)
                                    .foregroundStyle(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(viewModel.isValidLoginForm ? Color.white : Color.white.opacity(0.5))
                                    .cornerRadius(12)
                            }
                        }
                        .disabled(!viewModel.isValidLoginForm || viewModel.isLoading)
                    }
                    .padding(.horizontal, 24)

                    Spacer()

                    // Create Account Link
                    HStack(spacing: 4) {
                        Text("Don't have an account?")
                            .foregroundStyle(.white.opacity(0.9))

                        Button("Create Account") {
                            isRegisterViewPresented = true
                        }
                        .foregroundStyle(.white)
                        .fontWeight(.bold)
                    }
                    .padding(.bottom, 24)
                }
            }
            .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK") {
                    viewModel.clearError()
                }
            } message: {
                if let errorMessage = viewModel.errorMessage {
                    Text(errorMessage)
                }
            }
            .navigationDestination(isPresented: $isRegisterViewPresented) {
                RegisterView(viewModel: viewModel)
            }
        }
    }
}

#Preview {
    let container = DependencyContainer.shared
    return LoginView(viewModel: container.makeAuthViewModel())
}
