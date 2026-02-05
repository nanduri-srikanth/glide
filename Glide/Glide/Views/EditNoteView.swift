//
//  EditNoteView.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import SwiftUI

/// Edit Note View - modal sheet for editing existing notes
struct EditNoteView: View {

    // MARK: - State

    @StateObject private var viewModel: EditNoteViewModel
    @StateObject private var foldersViewModel: FoldersViewModel
    @FocusState private var focusedField: Field?

    // MARK: - Types

    enum Field {
        case title
        case content
    }

    // MARK: - Initialization

    init(
        viewModel: EditNoteViewModel,
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
                contentSection
                folderSection
            }
            .navigationTitle("Edit Note")
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
                            await viewModel.saveChanges()
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
                    focusedField = .content
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

    private var contentSection: some View {
        Section {
            TextEditor(text: $viewModel.content)
                .focused($focusedField, equals: .content)
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

    // Create a mock note to edit
    let mockNote = Note(
        id: "1",
        title: "Team Meeting Notes",
        content: "Discussed Q1 roadmap and assigned tasks. John will handle the frontend.",
        folderId: nil,
        tags: ["meeting", "work"],
        isPinned: false,
        isArchived: false
    )

    let viewModel = EditNoteViewModel(
        note: mockNote,
        notesRepository: container.notesRepository,
        logger: container.loggerService
    )

    let foldersViewModel = FoldersViewModel(
        foldersRepository: container.foldersRepository,
        logger: container.loggerService
    )

    return EditNoteView(
        viewModel: viewModel,
        foldersViewModel: foldersViewModel
    )
}
