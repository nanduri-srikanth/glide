//
//  CreateNoteView.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import SwiftUI

/// Create Note View - modal sheet for creating new notes
struct CreateNoteView: View {

    // MARK: - State

    @StateObject private var viewModel: CreateNoteViewModel
    @StateObject private var foldersViewModel: FoldersViewModel
    @FocusState private var focusedField: Field?

    // MARK: - Types

    enum Field {
        case title
        case transcript
    }

    // MARK: - Initialization

    init(
        viewModel: CreateNoteViewModel,
        foldersViewModel: FoldersViewModel
    ) {
        _viewModel = StateObject(wrappedValue: viewModel)
        _foldersViewModel = StateObject(wrappedValue: foldersViewModel)
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            Form {
                titleSection
                transcriptSection
                folderSection
            }
            .navigationTitle("New Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        viewModel.cancel()
                    }
                    .disabled(viewModel.isLoading)
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        Task {
                            await viewModel.createNote()
                        }
                    }
                    .disabled(!viewModel.canSave)
                    .fontWeight(.semibold)
                }
            }
            .disabled(viewModel.isLoading)
            .alert("Error", isPresented: Binding<Bool>(
                get: { viewModel.errorMessage != nil },
                set: { _ in viewModel.errorMessage = nil }
            )) {
                Button("OK") {
                    viewModel.errorMessage = nil
                }
            } message: {
                if let errorMessage = viewModel.errorMessage {
                    Text(errorMessage)
                }
            }
        }
        .interactiveDismissDisabled(viewModel.isLoading)
    }

    // MARK: - Sections

    private var titleSection: some View {
        Section {
            TextField("Note Title", text: $viewModel.title)
                .focused($focusedField, equals: .title)
                .submitLabel(.next)
                .onSubmit {
                    focusedField = .transcript
                }
        } header: {
            Text("Title")
                .font(.headline)
        } footer: {
            Text("Optional - if left blank, note will be titled 'Untitled'")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }

    private var transcriptSection: some View {
        Section {
            TextEditor(text: $viewModel.transcript)
                .focused($focusedField, equals: .transcript)
                .frame(minHeight: 150)
                .scrollContentBackground(.hidden)
        } header: {
            Text("Content")
                .font(.headline)
        } footer: {
            Text("Enter your note content here")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }

    private var folderSection: some View {
        Section {
            if foldersViewModel.isLoading {
                HStack {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Loading folders...")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            } else if foldersViewModel.hasFolders {
                Picker("Folder", selection: $viewModel.selectedFolderId) {
                    Text("No Folder")
                        .tag(nil as UUID?)

                    Divider()

                    ForEach(foldersViewModel.folders) { folder in
                        Label(folder.name, systemImage: folder.sfSymbolName)
                            .tag(folder.id as UUID?)
                    }
                }
                .pickerStyle(.menu)
            } else {
                HStack {
                    Image(systemName: "folder.badge.questionmark")
                        .foregroundColor(.secondary)
                    Text("No folders available")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
        } header: {
            Text("Folder")
                .font(.headline)
        } footer: {
            Text("Optionally select a folder to organize this note")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Preview

#Preview {
    let container = DependencyContainer.shared

    let viewModel = CreateNoteViewModel(
        notesRepository: container.notesRepository,
        foldersRepository: container.foldersRepository,
        logger: container.loggerService
    )

    let foldersViewModel = FoldersViewModel(
        foldersRepository: container.foldersRepository,
        logger: container.loggerService
    )

    return CreateNoteView(
        viewModel: viewModel,
        foldersViewModel: foldersViewModel
    )
}
