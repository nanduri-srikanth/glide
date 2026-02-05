//
//  NoteDetailView.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import SwiftUI

/// Note Detail View - displays full note with transcript, summary, and actions
struct NoteDetailView: View {

    // MARK: - State

    @StateObject private var viewModel: NoteDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showingDeleteAlert = false
    @State private var showingEditSheet = false

    // MARK: - Initialization

    init(viewModel: NoteDetailViewModel? = nil, noteId: String) {
        _viewModel = StateObject(wrappedValue: viewModel ?? DependencyContainer.shared.makeNoteDetailViewModel(noteId: noteId))
    }

    // MARK: - Body

    var body: some View {
        Group {
            if viewModel.isLoading {
                loadingView
            } else if let note = viewModel.note {
                noteContent(note)
            } else if let errorMessage = viewModel.errorMessage {
                errorView(errorMessage)
            } else {
                emptyView
            }
        }
        .navigationTitle(viewModel.note?.title ?? "Note")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                HStack(spacing: DesignConstants.spacingM) {
                    // Edit button
                    if let note = viewModel.note {
                        Button(action: {
                            showingEditSheet = true
                        }) {
                            Image(systemName: "pencil")
                                .foregroundColor(.blue)
                        }
                    }

                    // Pin toggle button
                    if let note = viewModel.note {
                        Button(action: {
                            Task {
                                await viewModel.togglePin()
                            }
                        }) {
                            Image(systemName: note.isPinned ? "pin.fill" : "pin")
                                .foregroundColor(note.isPinned ? .blue : .secondary)
                        }

                        // More options menu
                        Menu {
                            Button(action: {
                                showingDeleteAlert = true
                            }) {
                                Label("Delete", systemImage: "trash")
                            }

                            Button(action: {
                                Task {
                                    await viewModel.toggleArchive()
                                    dismiss()
                                }
                            }) {
                                Label(viewModel.note?.isArchived == true ? "Unarchive" : "Archive",
                                      systemImage: "archivebox")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            if let note = viewModel.note {
                EditNoteView(
                    viewModel: EditNoteViewModel(
                        note: note,
                        notesRepository: DependencyContainer.shared.notesRepository,
                        logger: DependencyContainer.shared.loggerService
                    ),
                    foldersViewModel: FoldersViewModel(
                        foldersRepository: DependencyContainer.shared.foldersRepository,
                        logger: DependencyContainer.shared.loggerService
                    )
                )
                .interactiveDismissDisabled(!viewModel.isLoading)
            }
        }
        .alert("Delete Note?", isPresented: $showingDeleteAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task {
                    await viewModel.deleteNote()
                    dismiss()
                }
            }
        }
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

    // MARK: - Views

    private var loadingView: some View {
        VStack(spacing: DesignConstants.spacingM) {
            ProgressView()
            Text("Loading note...")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: DesignConstants.spacingL) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: DesignConstants.iconSizeXL))
                .foregroundColor(.orange)

            Text("Couldn't Load Note")
                .font(.headline)

            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button(action: {
                viewModel.refresh()
            }) {
                Text("Retry")
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding(.horizontal, DesignConstants.spacingL)
                    .padding(.vertical, DesignConstants.spacingM)
                    .background(Color.blue)
                    .cornerRadius(DesignConstants.cornerRadiusM)
            }
        }
        .padding(DesignConstants.spacingXL)
    }

    private var emptyView: some View {
        VStack(spacing: DesignConstants.spacingL) {
            Image(systemName: "doc.text")
                .font(.system(size: DesignConstants.iconSizeXL))
                .foregroundColor(.secondary)

            Text("Note Not Found")
                .font(.headline)

            Text("The note you're looking for doesn't exist or has been deleted.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(DesignConstants.spacingXL)
    }

    private func noteContent(_ note: Note) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignConstants.spacingL) {
                // Audio duration (if present)
                if note.content.isEmpty == false {
                    audioDurationView(note)
                }

                // Summary (if available)
                if !note.content.isEmpty {
                    summaryView(note)
                }

                // Tags
                if !note.tags.isEmpty {
                    tagsView(note)
                }

                // Full transcript/content
                transcriptView(note)

                // Actions placeholder (would use NoteResponse.actions if we had it)
                actionsSection(note)
            }
            .padding(DesignConstants.spacingM)
        }
    }

    // MARK: - Component Views

    @ViewBuilder
    private func audioDurationView(_ note: Note) -> some View {
        // Note model doesn't have duration, but we show the word count as a substitute
        HStack(spacing: DesignConstants.spacingS) {
            Image(systemName: "clock")
                .font(.caption)
                .foregroundColor(.secondary)

            Text(note.readingTime)
                .font(.caption)
                .foregroundColor(.secondary)

            Spacer()
        }
        .padding(DesignConstants.spacingS)
        .background(Color(uiColor: .systemGray6))
        .cornerRadius(DesignConstants.cornerRadiusS)
    }

    @ViewBuilder
    private func summaryView(_ note: Note) -> some View {
        VStack(alignment: .leading, spacing: DesignConstants.spacingS) {
            HStack {
                Image(systemName: "sparkles")
                    .foregroundColor(.orange)
                    .font(.caption)

                Text("Summary")
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Spacer()
            }

            Text("No AI summary available yet. The note content is shown below.")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding(DesignConstants.spacingM)
        .background(Color.orange.opacity(0.1))
        .cornerRadius(DesignConstants.cornerRadiusM)
    }

    @ViewBuilder
    private func tagsView(_ note: Note) -> some View {
        VStack(alignment: .leading, spacing: DesignConstants.spacingS) {
            HStack {
                Image(systemName: "tag")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text("Tags")
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Spacer()
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: DesignConstants.spacingS) {
                    ForEach(note.tags, id: \.self) { tag in
                        Text("#\(tag)")
                            .font(.caption)
                            .foregroundColor(.blue)
                            .padding(.horizontal, DesignConstants.spacingM)
                            .padding(.vertical, DesignConstants.spacingXS)
                            .background(Color.blue.opacity(0.1))
                            .cornerRadius(DesignConstants.cornerRadiusL)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func transcriptView(_ note: Note) -> some View {
        VStack(alignment: .leading, spacing: DesignConstants.spacingS) {
            HStack {
                Image(systemName: "doc.text")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text("Transcript")
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Spacer()

                Text("\(note.wordCount) words")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Text(note.content)
                .font(.body)
                .lineSpacing(DesignConstants.spacingS)
                .foregroundColor(.primary)
        }
    }

    @ViewBuilder
    private func actionsSection(_ note: Note) -> some View {
        VStack(alignment: .leading, spacing: DesignConstants.spacingS) {
            HStack {
                Image(systemName: "checklist")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text("Actions")
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Spacer()
            }

            Text("No actions extracted yet. Connect to backend for AI-powered action extraction.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .padding(DesignConstants.spacingM)
                .frame(maxWidth: .infinity)
                .background(Color(uiColor: .systemGray6))
                .cornerRadius(DesignConstants.cornerRadiusM)
        }
    }
}

// MARK: - Action Card View (for future use with NoteResponse)

struct ActionCardView: View {
    let action: ActionResponse

    var body: some View {
        HStack(spacing: DesignConstants.spacingM) {
            // Action type icon
            ZStack {
                Circle()
                    .fill(action.status.color.opacity(0.2))
                    .frame(width: 44, height: 44)

                Image(systemName: action.actionType.icon)
                    .foregroundColor(action.status.color)
            }

            // Action details
            VStack(alignment: .leading, spacing: DesignConstants.spacingXS) {
                Text(action.title)
                    .font(.subheadline)
                    .fontWeight(.semibold)

                if let description = action.description {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }

                // Status and metadata
                HStack(spacing: DesignConstants.spacingS) {
                    Label(action.status.displayName, systemImage: action.status.icon)
                        .font(.caption2)
                        .foregroundColor(action.status.color)

                    if let scheduledDate = action.scheduledDate {
                        Label(scheduledDate.formatted(.dateTime.day().month().year().hour().minute()),
                              systemImage: "calendar")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }

            Spacer()
        }
        .padding(DesignConstants.spacingM)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(DesignConstants.cornerRadiusM)
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        // Create a mock note for preview
        let mockNote = Note(
            id: "1",
            title: "Team Meeting Notes",
            content: "Discussed Q1 roadmap and assigned tasks. John will handle the frontend, Sarah will work on the backend API. We need to have the MVP ready by the end of the month.",
            tags: ["meeting", "work", "q1"],
            isPinned: true
        )

        let viewModel = NoteDetailViewModel(
            noteId: "1",
            notesRepository: DependencyContainer.shared.notesRepository,
            logger: DependencyContainer.shared.loggerService
        )

        // Manually set the note for preview
        viewModel.note = mockNote

        return NoteDetailView(viewModel: viewModel, noteId: "1")
    }
}
