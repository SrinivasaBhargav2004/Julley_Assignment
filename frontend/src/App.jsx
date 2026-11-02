import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from './api/client';
import { useBoardSocket } from './hooks/useBoardSocket';
import { useUndoRedo } from './hooks/useUndoRedo';
import { EvaluatorBar } from './components/EvaluatorBar';
import { TopNavbar } from './components/TopNavbar';
import { BoardHeader } from './components/BoardHeader';
import { KanbanColumn } from './components/KanbanColumn';
import { TaskDetailModal } from './components/TaskDetailModal';
import { NewTaskModal } from './components/NewTaskModal';
import { NewBoardModal } from './components/NewBoardModal';
import { ActivityDrawer } from './components/ActivityDrawer';

export default function App() {
  // Evaluator & User State
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentRole, setCurrentRole] = useState('MEMBER');

  // Hierarchy State: Organizations -> Tenants -> Boards
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [boards, setBoards] = useState([]);
  const [activeBoard, setActiveBoard] = useState(null);

  // Board Content State: Columns & Tasks
  const [boardData, setBoardData] = useState(null);
  const [activities, setActivities] = useState([]);

  // UI Modal & Filter State
  const [selectedTask, setSelectedTask] = useState(null);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [newTaskDefaultColId, setNewTaskDefaultColId] = useState(null);
  const [isNewBoardModalOpen, setIsNewBoardModalOpen] = useState(false);
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');
  const [newColColor, setNewColColor] = useState('#6366f1');

  const undoRedo = useUndoRedo();

  // Socket event callbacks
  const handleTaskCreated = useCallback((newTask) => {
    setBoardData((prev) => {
      if (!prev) return prev;
      const exists = prev.columns.some((col) =>
        col.tasks.some((t) => t.id === newTask.id)
      );
      if (exists) return prev;

      return {
        ...prev,
        columns: prev.columns.map((col) => {
          if (col.id === newTask.columnId) {
            return { ...col, tasks: [...col.tasks, newTask] };
          }
          return col;
        }),
      };
    });
  }, []);

  const handleTaskUpdated = useCallback((updatedTask) => {
    setBoardData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((col) => ({
          ...col,
          tasks: col.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
        })),
      };
    });

    setSelectedTask((prev) => (prev?.id === updatedTask.id ? updatedTask : prev));
  }, []);

  const handleTaskMoved = useCallback((movedTask) => {
    setBoardData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((col) => {
          const filtered = col.tasks.filter((t) => t.id !== movedTask.id);
          if (col.id === movedTask.columnId) {
            const updated = [...filtered, movedTask].sort(
              (a, b) => a.position - b.position
            );
            return { ...col, tasks: updated };
          }
          return { ...col, tasks: filtered };
        }),
      };
    });
  }, []);

  const handleTaskDeleted = useCallback(({ id }) => {
    setBoardData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((col) => ({
          ...col,
          tasks: col.tasks.filter((t) => t.id !== id),
        })),
      };
    });
    setSelectedTask((prev) => (prev?.id === id ? null : prev));
  }, []);

  const handleColumnCreated = useCallback((newCol) => {
    setBoardData((prev) => {
      if (!prev) return prev;
      if (prev.columns.some((c) => c.id === newCol.id)) return prev;
      return {
        ...prev,
        columns: [...prev.columns, { ...newCol, tasks: [] }].sort(
          (a, b) => a.position - b.position
        ),
      };
    });
  }, []);

  const handleActivityLogged = useCallback((newLog) => {
    setActivities((prev) => [newLog, ...prev]);
  }, []);

  // 4. Load Complete Board Data (Columns + Tasks)
  const loadFullBoard = useCallback(async (boardId) => {
    try {
      const { board } = await api.getBoard(boardId);
      setActiveBoard(board);
      setBoardData(board);
    } catch (err) {
      console.error('Failed to load board details:', err);
    }
  }, []);

  const handleBoardSync = useCallback((boardId) => {
    if (boardId) loadFullBoard(boardId);
  }, [loadFullBoard]);

  // Initialize Socket with presence and room handling
  const { isConnected, activeUsers, focusCard } = useBoardSocket({
    currentUser,
    activeTenant: selectedTenant,
    activeBoard,
    onTaskCreated: handleTaskCreated,
    onTaskUpdated: handleTaskUpdated,
    onTaskMoved: handleTaskMoved,
    onTaskDeleted: handleTaskDeleted,
    onColumnCreated: handleColumnCreated,
    onActivityLogged: handleActivityLogged,
    onBoardSync: handleBoardSync,
  });

  // 1. Initial Load: Fetch Evaluator Users & Boot
  useEffect(() => {
    async function boot() {
      try {
        const { users: userList } = await api.getUsers();
        setUsers(userList);

        const defaultUser =
          userList.find((u) => u.email === 'alex.admin@acme.com') || userList[0];

        await handleSwitchUser(defaultUser.id);
      } catch (err) {
        console.error('Error during boot:', err);
      }
    }
    boot();
  }, []);

  // 2. Switch User
  const handleSwitchUser = async (userId) => {
    try {
      const res = await api.switchUser(userId);
      api.setAuth(res.token, res.user.id);
      setCurrentUser(res.user);

      const { organizations: orgs } = await api.getOrganizations();
      setOrganizations(orgs);

      if (orgs.length > 0) {
        const targetOrg = orgs[0];
        setSelectedOrg(targetOrg);

        const { tenants: branchList } = await api.getTenants(targetOrg.id);
        setTenants(branchList);

        if (branchList.length > 0) {
          const targetTenant = branchList[0];
          setSelectedTenant(targetTenant);
          api.setTenant(targetTenant.id, targetOrg.id);

          const membership = res.memberships?.find(
            (m) =>
              m.organizationId === targetOrg.id &&
              (m.tenantId === targetTenant.id || m.role === 'ORG_ADMIN')
          );
          setCurrentRole(membership?.role || 'MEMBER');

          await loadBoardsForTenant(targetTenant.id);
        } else {
          setSelectedTenant(null);
          setBoards([]);
          setActiveBoard(null);
          setBoardData(null);
        }
      } else {
        setSelectedOrg(null);
        setSelectedTenant(null);
        setTenants([]);
        setBoards([]);
        setActiveBoard(null);
        setBoardData(null);
      }
    } catch (err) {
      console.error('Failed to switch user:', err);
    }
  };

  // 3. Load Boards for Tenant
  const loadBoardsForTenant = async (tenantId) => {
    try {
      const { boards: tenantBoards } = await api.getBoards();
      setBoards(tenantBoards);

      if (tenantBoards.length > 0) {
        await loadFullBoard(tenantBoards[0].id);
      } else {
        setActiveBoard(null);
        setBoardData(null);
      }

      const { activities: actList } = await api.getActivities();
      setActivities(actList);
    } catch (err) {
      console.error('Failed to load boards for tenant:', err);
    }
  };

  // 5. Select Organization
  const handleSelectOrg = async (org) => {
    setSelectedOrg(org);
    try {
      const { tenants: branchList } = await api.getTenants(org.id);
      setTenants(branchList);

      if (branchList.length > 0) {
        await handleSelectTenant(branchList[0], org.id);
      } else {
        setSelectedTenant(null);
        setBoards([]);
        setActiveBoard(null);
        setBoardData(null);
      }
    } catch (err) {
      console.error('Failed to switch organization:', err);
    }
  };

  // 6. Select Tenant
  const handleSelectTenant = async (tenant, orgId = selectedOrg?.id) => {
    setSelectedTenant(tenant);
    api.setTenant(tenant.id, orgId);

    const membership = currentUser?.memberships?.find(
      (m) =>
        m.organizationId === orgId &&
        (m.tenantId === tenant.id || m.role === 'ORG_ADMIN')
    );
    setCurrentRole(membership?.role || 'MEMBER');

    await loadBoardsForTenant(tenant.id);
  };

  // 7. Select Board
  const handleSelectBoard = async (board) => {
    await loadFullBoard(board.id);
  };

  // -------------------------------------------------------------
  // Task Mutations with Optimistic Updates & Undo/Redo
  // -------------------------------------------------------------

  // Drag-and-Drop Task Move
  const handleTaskMove = async ({
    taskId,
    sourceColumnId,
    sourcePosition,
    targetColumnId,
    targetPosition,
    expectedVersion,
  }) => {
    const previousBoardData = boardData;

    setBoardData((prev) => {
      if (!prev) return prev;
      let movingTask = null;

      for (const col of prev.columns) {
        const found = col.tasks.find((t) => t.id === taskId);
        if (found) {
          movingTask = {
            ...found,
            columnId: targetColumnId,
            position: targetPosition,
            version: found.version + 1,
          };
          break;
        }
      }

      if (!movingTask) return prev;

      return {
        ...prev,
        columns: prev.columns.map((col) => {
          const remaining = col.tasks.filter((t) => t.id !== taskId);
          if (col.id === targetColumnId) {
            return {
              ...col,
              tasks: [...remaining, movingTask].sort((a, b) => a.position - b.position),
            };
          }
          return { ...col, tasks: remaining };
        }),
      };
    });

    undoRedo.pushAction({
      type: 'MOVE_TASK',
      description: 'Move task',
      undo: async () => {
        await api.moveTask(taskId, {
          targetColumnId: sourceColumnId,
          targetPosition: sourcePosition,
        });
      },
      redo: async () => {
        await api.moveTask(taskId, {
          targetColumnId,
          targetPosition,
        });
      },
    });

    try {
      await api.moveTask(taskId, {
        targetColumnId,
        targetPosition,
        expectedVersion,
      });
    } catch (err) {
      console.error('Failed to move task on server, reverting:', err);
      setBoardData(previousBoardData);
    }
  };

  // Update Task (supports OCC)
  const handleUpdateTask = async ({ taskId, updatedFields, previousTask }) => {
    const res = await api.updateTask(taskId, updatedFields);

    if (res?.task) {
      setBoardData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) => ({
            ...col,
            tasks: col.tasks.map((t) => (t.id === res.task.id ? res.task : t)),
          })),
        };
      });
      setSelectedTask(res.task);
    }

    undoRedo.pushAction({
      type: 'UPDATE_TASK',
      description: `Edit "${updatedFields.title || 'Task'}"`,
      undo: async () => {
        await api.updateTask(taskId, {
          title: previousTask.title,
          description: previousTask.description,
          priority: previousTask.priority,
          assigneeId: previousTask.assigneeId,
          dueDate: previousTask.dueDate,
          force: true,
        });
      },
      redo: async () => {
        await api.updateTask(taskId, { ...updatedFields, force: true });
      },
    });

    return res;
  };

  // Delete Task with optimistic UI removal
  const handleDeleteTask = async (taskId) => {
    try {
      setBoardData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) => ({
            ...col,
            tasks: col.tasks.filter((t) => t.id !== taskId),
          })),
        };
      });
      setSelectedTask(null);
      await api.deleteTask(taskId);
    } catch (err) {
      console.error('Failed to delete task:', err);
      if (activeBoard) loadFullBoard(activeBoard.id);
    }
  };

  // Create Column
  const handleCreateColumn = async (title, color = '#6366f1') => {
    if (!activeBoard || !title.trim()) return;
    try {
      const { column } = await api.createColumn(activeBoard.id, title.trim(), color);
      setBoardData((prev) => {
        if (!prev) return prev;
        if (prev.columns.some((c) => c.id === column.id)) return prev;
        return {
          ...prev,
          columns: [...prev.columns, { ...column, tasks: [] }],
        };
      });
    } catch (err) {
      console.error('Failed to create column:', err);
    }
  };

  // Create Task
  const handleCreateTask = async (formData) => {
    if (!activeBoard) return;
    const { task } = await api.createTask(activeBoard.id, formData);

    setBoardData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((col) => {
          if (col.id === task.columnId) {
            return { ...col, tasks: [...col.tasks, task] };
          }
          return col;
        }),
      };
    });
  };

  // Create Board
  const handleCreateBoard = async (title, description) => {
    const { board } = await api.createBoard(title, description);
    setBoards((prev) => [board, ...prev]);
    await loadFullBoard(board.id);
  };

  // Filter Tasks by Search Query and Priority
  const filteredColumns = useMemo(() => {
    if (!boardData?.columns) return [];

    return boardData.columns.map((col) => {
      const filteredTasks = col.tasks.filter((t) => {
        if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) {
          return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchDesc = t.description?.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc) return false;
        }

        return true;
      });

      return {
        ...col,
        tasks: filteredTasks.sort((a, b) => a.position - b.position),
      };
    });
  }, [boardData, searchQuery, priorityFilter]);

  const canCreateBoard = currentRole === 'ORG_ADMIN' || currentRole === 'TENANT_ADMIN';

  return (
    <div className="app-container">
      {/* 1. Evaluator Role & Multi-User Switcher Banner */}
      <EvaluatorBar
        users={users}
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
      />

      {/* 2. Top Navigation Bar: Org Switcher, Tenant Switcher, Live Presence */}
      <TopNavbar
        organizations={organizations}
        selectedOrg={selectedOrg}
        onSelectOrg={handleSelectOrg}
        tenants={tenants}
        selectedTenant={selectedTenant}
        onSelectTenant={handleSelectTenant}
        currentUser={currentUser}
        currentRole={currentRole}
        isConnected={isConnected}
        activeUsers={activeUsers}
        onOpenActivityDrawer={() => setIsActivityDrawerOpen(true)}
      />

      {/* 3. Subheader: Board Selector, Undo/Redo, Search, New Task */}
      <BoardHeader
        boards={boards}
        activeBoard={activeBoard}
        onSelectBoard={handleSelectBoard}
        onOpenNewBoardModal={() => setIsNewBoardModalOpen(true)}
        onOpenNewTaskModal={() => {
          setNewTaskDefaultColId(boardData?.columns?.[0]?.id || null);
          setIsNewTaskModalOpen(true);
        }}
        canCreateBoard={canCreateBoard}
        undoRedo={undoRedo}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
      />

      {/* 4. Kanban Columns & Task Cards Viewport */}
      <main className="kanban-viewport">
        {filteredColumns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={col.tasks}
            onTaskClick={(task) => setSelectedTask(task)}
            onTaskMove={handleTaskMove}
            onOpenNewTaskModal={(colId) => {
              setNewTaskDefaultColId(colId);
              setIsNewTaskModalOpen(true);
            }}
            activeCollaborators={activeUsers}
            currentUserId={currentUser?.id}
          />
        ))}

        {/* Inline Add Column for Admins */}
        {canCreateBoard && activeBoard && (
          <div
            style={{
              width: '280px',
              minWidth: '280px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              alignSelf: 'flex-start',
            }}
          >
            {!isAddingColumn ? (
              <button
                className="btn-secondary"
                onClick={() => setIsAddingColumn(true)}
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
              >
                + Add Another Column
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Column title (e.g. QA / Testing)..."
                  value={newColTitle}
                  onChange={(e) => setNewColTitle(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.85rem' }}
                  autoFocus
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Color:</span>
                  {['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6'].map((clr) => (
                    <button
                      key={clr}
                      type="button"
                      onClick={() => setNewColColor(clr)}
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: clr,
                        border: newColColor === clr ? '2px solid white' : 'none',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem' }}
                    onClick={() => {
                      if (newColTitle.trim()) {
                        handleCreateColumn(newColTitle, newColColor);
                        setNewColTitle('');
                        setIsAddingColumn(false);
                      }
                    }}
                  >
                    Add Column
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem' }}
                    onClick={() => {
                      setIsAddingColumn(false);
                      setNewColTitle('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {filteredColumns.length === 0 && (
          <div
            style={{
              padding: '60px 40px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              width: '100%',
            }}
          >
            <h3>No boards or columns found in this tenant branch.</h3>
            <p style={{ marginTop: '8px' }}>
              Create a board or switch to another tenant above.
            </p>
          </div>
        )}
      </main>

      {/* 5. Modals & Drawers */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          columns={boardData?.columns || []}
          users={users}
          onClose={() => setSelectedTask(null)}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          focusCard={focusCard}
        />
      )}

      {isNewTaskModalOpen && (
        <NewTaskModal
          columns={boardData?.columns || []}
          defaultColumnId={newTaskDefaultColId}
          users={users}
          onClose={() => setIsNewTaskModalOpen(false)}
          onCreateTask={handleCreateTask}
        />
      )}

      {isNewBoardModalOpen && (
        <NewBoardModal
          onClose={() => setIsNewBoardModalOpen(false)}
          onCreateBoard={handleCreateBoard}
        />
      )}

      <ActivityDrawer
        isOpen={isActivityDrawerOpen}
        onClose={() => setIsActivityDrawerOpen(false)}
        activities={activities}
        tenantName={selectedTenant?.name || 'Current Branch'}
      />
    </div>
  );
}
