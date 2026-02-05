//
//  FoldersSidebarView.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import SwiftUI

/// Folders Sidebar View - displays folder hierarchy
struct FoldersSidebarView: View {

    // MARK: - State

    @StateObject private var viewModel: FoldersViewModel
    var onFolderSelect: (UUID?) -> Void

    // MARK: - Initialization

    init(viewModel: FoldersViewModel? = nil, onFolderSelect: @escaping (UUID?) -> Void) {
        _viewModel = StateObject(wrappedValue: viewModel ?? DependencyContainer.shared.makeFoldersViewModel())
        self.onFolderSelect = onFolderSelect
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerView

            Divider()

            // Content
            if viewModel.isLoading {
                loadingView
            } else if let errorMessage = viewModel.errorMessage, viewModel.isEmpty {
                errorView(errorMessage)
            } else if viewModel.isEmpty {
                emptyView
            } else {
                folderList
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .systemGroupedBackground))
        .onAppear {
            if viewModel.folders.isEmpty {
                viewModel.loadFolders()
            }
        }
    }

    // MARK: - Views

    private var headerView: some View {
        HStack {
            Text("Folders")
                .font(.headline)
                .padding(.leading, DesignConstants.spacingM)

            Spacer()

            Button(action: {
                viewModel.refresh()
            }) {
                Image(systemName: "arrow.clockwise")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(.trailing, DesignConstants.spacingM)
        }
        .padding(.vertical, DesignConstants.spacingS)
        .contentShape(Rectangle())
    }

    private var loadingView: some View {
        VStack(spacing: DesignConstants.spacingM) {
            ProgressView()
                .scaleEffect(0.8)

            Text("Loading folders...")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: DesignConstants.spacingM) {
            Image(systemName: "exclamationmark.triangle")
                .font(.title3)
                .foregroundColor(.orange)

            Text("Couldn't Load Folders")
                .font(.caption)
                .fontWeight(.semibold)

            Text(message)
                .font(.caption2)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button(action: {
                viewModel.refresh()
            }) {
                Text("Retry")
                    .font(.caption)
                    .foregroundColor(.white)
                    .padding(.horizontal, DesignConstants.spacingM)
                    .padding(.vertical, DesignConstants.spacingXS)
                    .background(Color.blue)
                    .cornerRadius(DesignConstants.cornerRadiusS)
            }
        }
        .padding(DesignConstants.spacingL)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyView: some View {
        VStack(spacing: DesignConstants.spacingM) {
            Image(systemName: "folder")
                .font(.title2)
                .foregroundColor(.secondary)

            Text("No Folders")
                .font(.caption)
                .foregroundColor(.secondary)

            Text("Create folders to organize notes")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var folderList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: DesignConstants.spacingXS) {
                // All Notes system folder
                folderRow(viewModel.allNotesSystemFolder)
                    .onTapGesture {
                        viewModel.selectFolder(viewModel.allNotesSystemFolder)
                        onFolderSelect(nil) // nil means show all notes
                    }

                Divider()

                // User folders
                ForEach(viewModel.folders) { folder in
                    folderTree(folder, depth: 0)
                }
            }
            .padding(.vertical, DesignConstants.spacingS)
        }
    }

    // MARK: - Folder Tree

    @ViewBuilder
    private func folderTree(_ folder: FolderResponse, depth: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            folderRow(folder, depth: depth)
                .onTapGesture {
                    viewModel.selectFolder(folder)
                    onFolderSelect(folder.id)
                }

            // Children (if expanded)
            if folder.hasChildren && viewModel.isExpanded(folder.id) {
                ForEach(folder.children) { child in
                    folderTree(child, depth: depth + 1)
                }
            }
        }
    }

    private func folderRow(_ folder: FolderResponse, depth: Int = 0) -> some View {
        HStack(spacing: DesignConstants.spacingS) {
            // Indentation for nested folders
            if depth > 0 {
                Spacer()
                    .frame(width: CGFloat(depth) * DesignConstants.spacingL)
            }

            // Expand/collapse icon for folders with children
            if folder.hasChildren {
                Image(systemName: viewModel.isExpanded(folder.id) ? "chevron.down" : "chevron.right")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .onTapGesture {
                        withAnimation {
                            viewModel.toggleExpanded(folder.id)
                        }
                    }
            } else {
                Spacer()
                    .frame(width: DesignConstants.spacingS)
            }

            // Folder icon or emoji
            if let emoji = folder.emoji, !emoji.isEmpty {
                Text(emoji)
                    .font(.system(size: DesignConstants.fontSizeBody))
            } else {
                Image(systemName: folder.sfSymbolName)
                    .font(.system(size: DesignConstants.iconSizeS))
                    .foregroundColor(folder.folderColor ?? .secondary)
            }

            // Folder name
            Text(folder.name)
                .font(.subheadline)
                .foregroundColor(viewModel.isSelected(folder.id) ? .primary : .secondary)
                .lineLimit(1)

            Spacer()

            // Note count badge
            if folder.noteCount > 0 {
                Text("\(folder.noteCount)")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, DesignConstants.spacingXS)
                    .padding(.vertical, DesignConstants.spacingXS * 0.5)
                    .background(
                        viewModel.isSelected(folder.id) ?
                            Color.blue.opacity(0.2) :
                            Color(uiColor: .systemGray5)
                    )
                    .cornerRadius(DesignConstants.cornerRadiusS)
            }
        }
        .padding(.horizontal, DesignConstants.spacingM)
        .padding(.vertical, DesignConstants.spacingS)
        .background(
            viewModel.isSelected(folder.id) ?
                Color.blue.opacity(0.1) : Color.clear
        )
        .cornerRadius(DesignConstants.cornerRadiusM)
        .padding(.horizontal, DesignConstants.spacingS)
    }

    // MARK: - Context Menu

    private func folderContextMenu(_ folder: FolderResponse) -> some View {
        Menu {
            Button(action: {
                // Rename action
            }) {
                Label("Rename", systemImage: "pencil")
            }

            Button(action: {
                // Delete action
            }) {
                Label("Delete", systemImage: "trash")
            }
        } label: {
            EmptyView()
        }
    }
}

// MARK: - Preview

#Preview {
    let viewModel = FoldersViewModel(
        foldersRepository: DependencyContainer.shared.foldersRepository,
        logger: DependencyContainer.shared.loggerService
    )

    return FoldersSidebarView(viewModel: viewModel) { folderId in
        print("Selected folder: \(String(describing: folderId))")
    }
    .frame(width: 280)
}
