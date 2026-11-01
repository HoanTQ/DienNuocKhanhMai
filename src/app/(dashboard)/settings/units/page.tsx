'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Search, Ruler } from 'lucide-react';
import type { Unit } from '@/lib/types';

/**
 * Trang Quản lý Danh mục Đơn vị tính
 *
 * Chức năng:
 * - Xem danh sách đơn vị tính
 * - Thêm đơn vị tính mới
 * - Sửa đơn vị tính
 * - Xóa đơn vị tính (soft delete: is_active = false)
 * - Tìm kiếm
 */
export default function UnitsPage() {
  const supabase = createClient();

  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [formData, setFormData] = useState({ name: '', abbreviation: '', description: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (!error && data) {
      setUnits(data);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const filteredUnits = units.filter((unit) =>
    unit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (unit.abbreviation || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreateForm = () => {
    setEditingUnit(null);
    setFormData({ name: '', abbreviation: '', description: '' });
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({
      name: unit.name,
      abbreviation: unit.abbreviation || '',
      description: unit.description || '',
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingUnit(null);
    setFormData({ name: '', abbreviation: '', description: '' });
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Tên đơn vị tính không được để trống');
      return;
    }

    setSubmitting(true);

    try {
      if (editingUnit) {
        // Update
        const { error } = await supabase
          .from('units')
          .update({
            name: formData.name.trim(),
            abbreviation: formData.abbreviation.trim() || null,
            description: formData.description.trim() || null,
          })
          .eq('id', editingUnit.id);

        if (error) {
          if (error.code === '23505') {
            setFormError('Đơn vị tính này đã tồn tại');
          } else {
            throw error;
          }
          return;
        }
      } else {
        // Create
        const { error } = await supabase
          .from('units')
          .insert({
            name: formData.name.trim(),
            abbreviation: formData.abbreviation.trim() || null,
            description: formData.description.trim() || null,
          });

        if (error) {
          if (error.code === '23505') {
            setFormError('Đơn vị tính này đã tồn tại');
          } else {
            throw error;
          }
          return;
        }
      }

      closeForm();
      await fetchUnits();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Soft delete: set is_active = false
      const { error } = await supabase
        .from('units')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      setDeletingId(null);
      await fetchUnits();
    } catch (err) {
      console.error('Lỗi xóa đơn vị tính:', err);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground">Đơn vị tính</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý danh mục đơn vị tính dùng cho sản phẩm và quy đổi
          </p>
        </div>
        <Button onClick={openCreateForm} className="gap-2 cursor-pointer">
          <Plus className="h-4 w-4" />
          Thêm đơn vị
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm đơn vị tính..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Form (inline) */}
      {isFormOpen && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {editingUnit ? 'Sửa đơn vị tính' : 'Thêm đơn vị tính mới'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit-name">
                    Tên đơn vị <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="unit-name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="VD: Mét, Cuộn, Cái"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit-abbr">Viết tắt</Label>
                  <Input
                    id="unit-abbr"
                    value={formData.abbreviation}
                    onChange={(e) => setFormData((prev) => ({ ...prev, abbreviation: e.target.value }))}
                    placeholder="VD: m, kg, cái"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit-desc">Mô tả</Label>
                <Input
                  id="unit-desc"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="VD: Đơn vị đo chiều dài"
                />
              </div>

              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}

              <div className="flex gap-3">
                <Button type="submit" disabled={submitting} className="cursor-pointer">
                  {submitting ? 'Đang lưu...' : editingUnit ? 'Cập nhật' : 'Thêm'}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm} className="cursor-pointer">
                  Hủy
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Units List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Đang tải...</div>
          ) : filteredUnits.length === 0 ? (
            <div className="p-8 text-center">
              <Ruler className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Không tìm thấy đơn vị tính phù hợp' : 'Chưa có đơn vị tính nào'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Desktop Header */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_120px_1fr_100px] gap-4 px-4 py-3 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span>Tên đơn vị</span>
                <span>Viết tắt</span>
                <span>Mô tả</span>
                <span className="text-center">Thao tác</span>
              </div>

              {filteredUnits.map((unit) => (
                <div
                  key={unit.id}
                  className="flex flex-col sm:grid sm:grid-cols-[1fr_120px_1fr_100px] gap-2 sm:gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  {/* Name */}
                  <div className="font-medium text-sm text-foreground">{unit.name}</div>

                  {/* Abbreviation */}
                  <div className="text-sm text-muted-foreground">
                    {unit.abbreviation || '—'}
                  </div>

                  {/* Description */}
                  <div className="text-sm text-muted-foreground truncate">
                    {unit.description || '—'}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-center gap-1">
                    {deletingId === unit.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(unit.id)}
                          className="h-7 text-xs cursor-pointer"
                        >
                          Xóa
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeletingId(null)}
                          className="h-7 text-xs cursor-pointer"
                        >
                          Hủy
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditForm(unit)}
                          className="h-8 w-8 p-0 cursor-pointer"
                          aria-label={`Sửa ${unit.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeletingId(unit.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive cursor-pointer"
                          aria-label={`Xóa ${unit.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {!loading && (
        <p className="text-xs text-muted-foreground text-center">
          Tổng: {filteredUnits.length} đơn vị tính
        </p>
      )}
    </div>
  );
}
