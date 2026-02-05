//
//  RegisterView.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import SwiftUI

struct RegisterView: View {
    // MARK: - State

    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: AuthViewModel

    // MARK: - Initialization

    init(viewModel: AuthViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                colors: [Color.purple.opacity(0.6), Color.blue.opacity(0.6)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    // Title
                    VStack(spacing: 8) {
                        Image(systemName: "waveform.circle.fill")
                            .font(.system(size: 60))
                            .foregroundStyle(.white)

                        Text("Create Account")
                            .font(.title)
                            .fontWeight(.bold)
                            .foregroundStyle(.white)

                        Text("Start organizing your voice memos")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.9))
                    }
                    .padding(.bottom, 20)

                    // Form
                    VStack(spacing: 16) {
                        // Full Name TextField
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Full Name")
                                .font(.headline)
                                .foregroundStyle(.white)

                            TextField("Enter your full name", text: $viewModel.name)
                                .textFieldStyle(.plain)
                                .padding()
                                .background(Color.white.opacity(0.2))
                                .cornerRadius(12)
                                .foregroundStyle(.white)
                                .autocapitalization(.words)
                        }

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
                                .onChange(of: viewModel.email) { oldValue, newValue in
                                    viewModel.validateEmail()
                                }

                            // Email validation feedback
                            if !viewModel.email.isEmpty && viewModel.emailErrorMessage != nil {
                                HStack(spacing: 4) {
                                    Image(systemName: "exclamationmark.circle.fill")
                                        .font(.caption)
                                    Text(viewModel.emailErrorMessage!)
                                        .font(.caption)
                                }
                                .foregroundStyle(.white.opacity(0.9))
                            } else if !viewModel.email.isEmpty && viewModel.isEmailValid {
                                HStack(spacing: 4) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.caption)
                                    Text("Valid email format")
                                        .font(.caption)
                                }
                                .foregroundStyle(.green)
                            }
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

                            // Password strength indicator
                            if !viewModel.password.isEmpty {
                                Text(passwordStrengthMessage)
                                    .font(.caption)
                                    .foregroundStyle(passwordStrengthColor)
                            }
                        }

                        // Confirm Password SecureField
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Confirm Password")
                                .font(.headline)
                                .foregroundStyle(.white)

                            SecureField("Confirm your password", text: $viewModel.confirmPassword)
                                .textFieldStyle(.plain)
                                .padding()
                                .background(Color.white.opacity(0.2))
                                .cornerRadius(12)
                                .foregroundStyle(.white)

                            // Password match indicator
                            if !viewModel.confirmPassword.isEmpty {
                                Text(passwordMatchMessage)
                                    .font(.caption)
                                    .foregroundStyle(passwordMatchColor)
                            }
                        }

                        // Error Message
                        if let errorMessage = viewModel.errorMessage {
                            Text(errorMessage)
                                .font(.caption)
                                .foregroundStyle(.white)
                                .padding(.vertical, 4)
                        }

                        // Register Button
                        Button(action: {
                            Task {
                                await viewModel.register()
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
                                Text("Create Account")
                                    .font(.headline)
                                    .foregroundStyle(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(viewModel.isValidRegistrationForm ? Color.white : Color.white.opacity(0.5))
                                    .cornerRadius(12)
                            }
                        }
                        .disabled(!viewModel.isValidRegistrationForm || viewModel.isLoading)
                    }
                    .padding(.horizontal, 24)

                    Spacer()

                    // Back to Login Link
                    Button("Back to Login") {
                        dismiss()
                    }
                    .foregroundStyle(.white)
                    .fontWeight(.bold)
                    .padding(.bottom, 24)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button("Cancel") {
                    dismiss()
                }
                .foregroundStyle(.white)
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
    }

    // MARK: - Computed Properties

    private var passwordStrengthMessage: String {
        let count = viewModel.password.count
        switch count {
        case 0..<6:
            return "Too short (min 8 characters)"
        case 6..<8:
            return "Almost there (8+ characters required)"
        default:
            return "✓ Strong enough"
        }
    }

    private var passwordStrengthColor: Color {
        let count = viewModel.password.count
        switch count {
        case 0..<6:
            return .red
        case 6..<8:
            return .orange
        default:
            return .green
        }
    }

    private var passwordMatchMessage: String {
        if viewModel.confirmPassword.isEmpty {
            return ""
        }
        return viewModel.password == viewModel.confirmPassword ? "✓ Passwords match" : "Passwords do not match"
    }

    private var passwordMatchColor: Color {
        if viewModel.confirmPassword.isEmpty {
            return .white
        }
        return viewModel.password == viewModel.confirmPassword ? .green : .red
    }
}

#Preview {
    let container = DependencyContainer.shared
    return NavigationView {
        RegisterView(viewModel: container.makeAuthViewModel())
    }
}
